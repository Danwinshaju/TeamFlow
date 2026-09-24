import { Server } from 'socket.io';
import { jwtVerify } from 'jose';

export function attachMessaging(server, pool, secret, origin) {
  const origins = Array.isArray(origin) ? origin : [origin];
  if (!secret || secret.length < 32) throw new Error('JWT_SECRET is required for messaging.');
  const io = new Server(server, { maxHttpBufferSize: 4_500_000,
    allowRequest: (request, done) => {
      // Browsers omit Origin on same-origin polling GETs. Fetch Metadata and
      // the configured host still distinguish these from cross-site requests.
      const configuredHost = origins.some(value => request.headers.host === new URL(value).host);
      // Android browsers can omit both Origin and Fetch Metadata on the
      // Socket.IO polling/upgrade request. The exact configured Host is still
      // a safe same-app boundary; requests carrying another Origin are denied.
      const sameOriginPolling = !request.headers.origin && configuredHost;
      let matchingRequestHost = false;
      try {
        const requestOrigin = new URL(request.headers.origin);
        matchingRequestHost = ['http:', 'https:'].includes(requestOrigin.protocol) && requestOrigin.host === request.headers.host;
      } catch { /* A missing or malformed Origin is handled by sameOriginPolling. */ }
      const allowed = origins.includes(request.headers.origin) || matchingRequestHost || sameOriginPolling;
      if (!allowed) console.warn('Messaging origin rejected', { origin: request.headers.origin || '(missing)', host: request.headers.host, allowedOrigins: origins });
      done(null, allowed);
    },
  });
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  async function authorize(socket) {
    const token = (socket.handshake.headers.cookie || '').split(';').map(s => s.trim()).find(s => s.startsWith('teamflow_access='))?.slice(16);
    if (!token) throw new Error('Sign in again to use messaging.');
    const { payload } = await jwtVerify(token, new TextEncoder().encode(secret), {
      algorithms: ['HS256'], issuer: 'teamflow', audience: 'teamflow-web', requiredClaims: ['sub', 'sid', 'exp', 'iat'],
    });
    if (payload.type !== 'access' || !uuid.test(payload.sub || '') || !uuid.test(payload.sid || '')) throw new Error('Invalid session.');
    const slug = socket.handshake.auth?.workspaceSlug;
    if (typeof slug !== 'string' || slug.length > 160) throw new Error('Workspace required.');
    const { rows } = await pool.query(`SELECT u.id, u.name, w.id AS workspace_id
      FROM sessions s JOIN users u ON u.id=s.user_id
      JOIN workspace_members m ON m.user_id=u.id JOIN workspaces w ON w.id=m.workspace_id
      WHERE s.id=$1 AND u.id=$2 AND s.expires_at>now() AND u.status!='suspended' AND w.slug=$3`, [payload.sid, payload.sub, slug]);
    if (!rows[0]) throw new Error('Workspace access is no longer available.');
    return rows[0];
  }
  io.use(async (socket, next) => {
    try { socket.data.member = await authorize(socket); next(); }
    catch (error) {
      const reason = error instanceof Error ? error.message : 'Messaging authorization failed.';
      if (!/"exp" claim timestamp check failed|token.*expired/i.test(reason)) {
        console.warn('Messaging connection rejected', { reason, origin: socket.handshake.headers.origin, workspace: socket.handshake.auth?.workspaceSlug });
      }
      next(new Error(reason));
    }
  });
  io.on('connection', socket => {
    const room = socket.data.member.workspace_id;
    socket.join(room);
    const expiry = setTimeout(() => socket.disconnect(true), 14 * 60_000);
    socket.on('disconnect', () => clearTimeout(expiry));
    socket.on('messages:history', async (ack) => {
      if (typeof ack !== 'function') return;
      try {
        const member = await authorize(socket);
        const { rows } = await pool.query(`SELECT m.id,m.body,m.created_at AS "createdAt",m.user_id AS "userId",u.name,
          m.attachment_type AS "attachmentType",m.attachment_name AS "attachmentName",
          m.attachment_mime_type AS "attachmentMimeType",m.attachment_data_url AS "attachmentDataUrl",
          m.recipient_user_id AS "recipientUserId",m.reply_to_id AS "replyToId",m.deleted_at AS "deletedAt",
          r.body AS "replyBody",ru.name AS "replyName",r.deleted_at AS "replyDeletedAt"
          FROM workspace_messages m JOIN users u ON u.id=m.user_id
          LEFT JOIN workspace_messages r ON r.id=m.reply_to_id LEFT JOIN users ru ON ru.id=r.user_id
          WHERE m.workspace_id=$1 AND (m.recipient_user_id IS NULL OR m.user_id=$2 OR m.recipient_user_id=$2)
          ORDER BY m.created_at DESC,m.id DESC LIMIT 100`, [member.workspace_id, member.id]);
        ack({ messages: rows.reverse() });
      } catch { ack({ error: 'Unable to load messages. Please reconnect.' }); }
    });
    socket.on('messages:send', async (data, ack) => {
      if (typeof ack !== 'function') return;
      const body = typeof data?.body === 'string' ? data.body.trim() : '';
      const attachment = data?.attachment;
      const recipientUserId = data?.recipientUserId || null;
      const replyToId = data?.replyToId || null;
      const types = { image: /^image\/(png|jpeg|webp|gif)$/, audio: /^audio\/(webm|ogg|mpeg|wav|mp4|x-m4a)(;.*)?$/, file: /^(application\/pdf|text\/plain|application\/(msword|vnd\.openxmlformats-officedocument\.wordprocessingml\.document|vnd\.ms-excel|vnd\.openxmlformats-officedocument\.spreadsheetml\.sheet))$/ };
      const hasAttachment = attachment && typeof attachment.dataUrl === 'string' && typeof attachment.type === 'string';
      const validAttachment = !hasAttachment || (types[attachment.type]?.test(attachment.mimeType || '') && attachment.dataUrl.startsWith(`data:${attachment.mimeType};base64,`) && attachment.dataUrl.length <= 4_200_000 && typeof attachment.name === 'string' && attachment.name.length <= 255);
      if ((!body && !hasAttachment) || body.length > 2000 || !validAttachment || !uuid.test(data?.id || '') || (recipientUserId && !uuid.test(recipientUserId)) || (replyToId && !uuid.test(replyToId))) {
        ack({ error: 'Add text or a supported image, voice note, PDF, document, or spreadsheet under 3 MB.' }); return;
      }
      try {
        const member = await authorize(socket);
        if (recipientUserId) {
          if (recipientUserId === member.id) { ack({ error: 'Choose another workspace member for a private message.' }); return; }
          const recipient = await pool.query('SELECT 1 FROM workspace_members WHERE workspace_id=$1 AND user_id=$2', [room, recipientUserId]);
          if (!recipient.rowCount) { ack({ error: 'That person is no longer in this workspace.' }); return; }
        }
        if (replyToId) {
          const reply = await pool.query(`SELECT 1 FROM workspace_messages WHERE id=$1 AND workspace_id=$2 AND
            (($4::uuid IS NULL AND recipient_user_id IS NULL) OR
             ($4::uuid IS NOT NULL AND ((user_id=$3 AND recipient_user_id=$4) OR (user_id=$4 AND recipient_user_id=$3))))`, [replyToId, room, member.id, recipientUserId]);
          if (!reply.rowCount) { ack({ error: 'The message you replied to is no longer available.' }); return; }
        }
        const { rows } = await pool.query(`INSERT INTO workspace_messages(id,workspace_id,user_id,body,attachment_type,attachment_name,attachment_mime_type,attachment_data_url,recipient_user_id,reply_to_id)
          SELECT $1,$2,$3,$4,$5,$6,$7,$8,$9,$10
          WHERE (SELECT count(*) FROM workspace_messages WHERE user_id=$3 AND created_at>now()-interval '1 minute') < 30
          ON CONFLICT (id) DO NOTHING
          RETURNING id,body,created_at AS "createdAt",user_id AS "userId",attachment_type AS "attachmentType",attachment_name AS "attachmentName",attachment_mime_type AS "attachmentMimeType",attachment_data_url AS "attachmentDataUrl",recipient_user_id AS "recipientUserId",reply_to_id AS "replyToId",deleted_at AS "deletedAt"`, [data.id, room, member.id, body, hasAttachment ? attachment.type : null, hasAttachment ? attachment.name : null, hasAttachment ? attachment.mimeType : null, hasAttachment ? attachment.dataUrl : null, recipientUserId, replyToId]);
        if (!rows[0]) {
          const existing = await pool.query('SELECT id FROM workspace_messages WHERE id=$1 AND user_id=$2 AND workspace_id=$3', [data.id, member.id, room]);
          if (existing.rowCount) { ack({ ok: true }); return; }
          ack({ error: 'Please slow down. You can send 30 messages per minute.' }); return;
        }
        let replyPreview = {};
        if (replyToId) {
          const preview = await pool.query('SELECT m.body,u.name,m.deleted_at AS "deletedAt" FROM workspace_messages m JOIN users u ON u.id=m.user_id WHERE m.id=$1', [replyToId]);
          replyPreview = { replyBody: preview.rows[0]?.body || '', replyName: preview.rows[0]?.name || '', replyDeletedAt: preview.rows[0]?.deletedAt || null };
        }
        const message = { ...rows[0], ...replyPreview, name: member.name };
        ack({ ok: true, message });
        // Recheck recipients so removed members and revoked sessions cannot receive new messages.
        await Promise.all([...io.sockets.sockets.values()].filter(peer => peer.rooms.has(room)).map(async peer => {
          try { const receivingMember = await authorize(peer); if (!recipientUserId || receivingMember.id === member.id || receivingMember.id === recipientUserId) peer.emit('messages:new', message); }
          catch { peer.disconnect(true); }
        }));
      } catch {
        ack({ error: 'Message could not be sent. Reconnect and try again.' });
      }
    });
    socket.on('messages:delete', async (data, ack) => {
      if (typeof ack !== 'function' || !uuid.test(data?.id || '')) return;
      try {
        const member = await authorize(socket);
        const { rows } = await pool.query(`UPDATE workspace_messages SET body='',attachment_type=NULL,attachment_name=NULL,attachment_mime_type=NULL,attachment_data_url=NULL,deleted_at=now()
          WHERE id=$1 AND workspace_id=$2 AND user_id=$3
          RETURNING id,recipient_user_id AS "recipientUserId",deleted_at AS "deletedAt"`, [data.id, room, member.id]);
        if (!rows[0]) { ack({ error: 'Only your own available messages can be deleted.' }); return; }
        ack({ ok: true });
        await Promise.all([...io.sockets.sockets.values()].filter(peer => peer.rooms.has(room)).map(async peer => {
          try { const receivingMember = await authorize(peer); if (!rows[0].recipientUserId || receivingMember.id === member.id || receivingMember.id === rows[0].recipientUserId) peer.emit('messages:deleted', rows[0]); }
          catch { peer.disconnect(true); }
        }));
      } catch { ack({ error: 'Message could not be deleted.' }); }
    });
  });
  return io;
}
