import { Express, Request, Response } from 'express';
import { Pool } from 'pg';
import { Server } from 'socket.io';
import { requireAuth } from './auth';

export function setupRoutes(app: Express, pool: Pool, io: Server, upload: any, getFileUrl: any) {

  // ==========================================
  // USERS & PROFILES
  // ==========================================
  app.get('/v1/users', requireAuth, async (req: Request, res: Response) => {
    const client = await pool.connect();
    try {
      const result = await client.query('SELECT id, email, full_name, avatar_url, role FROM users');
      res.json({ data: result.rows });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    } finally {
      client.release();
    }
  });

  app.get('/v1/profiles', requireAuth, async (req: Request, res: Response) => {
    const client = await pool.connect();
    try {
      const result = await client.query('SELECT id, full_name, avatar_url FROM users');
      res.json({ data: result.rows });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    } finally {
      client.release();
    }
  });

  // ==========================================
  // PROJECTS
  // ==========================================
  app.get('/v1/projects', requireAuth, async (req: Request, res: Response) => {
    const client = await pool.connect();
    try {
      const result = await client.query('SELECT * FROM projects ORDER BY name ASC');
      res.json({ data: result.rows });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    } finally {
      client.release();
    }
  });

  app.post('/v1/projects', requireAuth, async (req: Request, res: Response) => {
    const client = await pool.connect();
    try {
      const { name, description } = req.body;
      const result = await client.query(
        'INSERT INTO projects (name, description) VALUES ($1, $2) RETURNING id',
        [name, description]
      );
      res.json({ data: result.rows[0].id });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    } finally {
      client.release();
    }
  });

  app.delete('/v1/projects/:id', requireAuth, async (req: Request, res: Response) => {
    const client = await pool.connect();
    try {
      await client.query('DELETE FROM projects WHERE id = $1', [req.params.id]);
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    } finally {
      client.release();
    }
  });

  // ==========================================
  // PLANOS
  // ==========================================
  app.get('/v1/planos', requireAuth, async (req: Request, res: Response) => {
    const { project_id } = req.query;
    const client = await pool.connect();
    try {
      let result;
      if (project_id) {
        result = await client.query('SELECT * FROM planos WHERE project_id = $1 ORDER BY created_at DESC', [project_id]);
      } else {
        result = await client.query('SELECT * FROM planos ORDER BY created_at DESC');
      }
      res.json({ data: result.rows });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    } finally {
      client.release();
    }
  });

  // ==========================================
  // CHATS (GROUPS & MESSAGES)
  // ==========================================
  app.get('/v1/groups', requireAuth, async (req: Request, res: Response) => {
    const client = await pool.connect();
    try {
      const result = await client.query('SELECT * FROM groups');
      res.json({ data: result.rows });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    } finally {
      client.release();
    }
  });

  app.get('/v1/group_members', requireAuth, async (req: Request, res: Response) => {
    const { user_id, group_id } = req.query;
    const client = await pool.connect();
    try {
      let query = 'SELECT * FROM group_members';
      const params = [];
      if (user_id) {
        query += ' WHERE user_id = $1';
        params.push(user_id);
      } else if (group_id) {
        query += ' WHERE group_id = $1';
        params.push(group_id);
      }
      const result = await client.query(query, params);
      res.json({ data: result.rows });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    } finally {
      client.release();
    }
  });

  app.post('/v1/groups', requireAuth, async (req: Request, res: Response) => {
    const client = await pool.connect();
    try {
      const { name, created_by } = req.body;
      const result = await client.query(
        'INSERT INTO groups (name, created_by) VALUES ($1, $2) RETURNING *',
        [name, created_by]
      );
      res.json({ data: result.rows[0] });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    } finally {
      client.release();
    }
  });

  app.post('/v1/group_members', requireAuth, async (req: Request, res: Response) => {
    const client = await pool.connect();
    try {
      const members = req.body; // array of {group_id, user_id}
      await client.query('BEGIN');
      for (const m of members) {
        await client.query('INSERT INTO group_members (group_id, user_id) VALUES ($1, $2)', [m.group_id, m.user_id]);
      }
      await client.query('COMMIT');
      res.json({ success: true });
    } catch (e: any) {
      await client.query('ROLLBACK');
      res.status(500).json({ error: e.message });
    } finally {
      client.release();
    }
  });

  app.get('/v1/pinned_conversations', requireAuth, async (req: Request, res: Response) => {
    const userId = (req as any).user.sub;
    const client = await pool.connect();
    try {
      const result = await client.query('SELECT * FROM pinned_conversations WHERE user_id = $1', [userId]);
      res.json({ data: result.rows });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    } finally {
      client.release();
    }
  });

  app.post('/v1/pinned_conversations', requireAuth, async (req: Request, res: Response) => {
    const client = await pool.connect();
    try {
      const { user_id, conversation_id, type } = req.body;
      await client.query('INSERT INTO pinned_conversations (user_id, conversation_id, type) VALUES ($1, $2, $3)', [user_id, conversation_id, type]);
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    } finally {
      client.release();
    }
  });

  app.delete('/v1/pinned_conversations', requireAuth, async (req: Request, res: Response) => {
    const client = await pool.connect();
    try {
      const { user_id, conversation_id } = req.query;
      await client.query('DELETE FROM pinned_conversations WHERE user_id = $1 AND conversation_id = $2', [user_id, conversation_id]);
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    } finally {
      client.release();
    }
  });

  // MESSAGES
  app.get('/v1/messages', requireAuth, async (req: Request, res: Response) => {
    const { user_id, group_ids, selected_user, selected_group } = req.query;
    const client = await pool.connect();
    try {
      let query = '';
      let params: any[] = [];
      
      if (selected_user) {
        const currentUser = (req as any).user.sub;
        query = `SELECT m.*, row_to_json(u.*) as sender 
                 FROM messages m 
                 JOIN users u ON m.sender_id = u.id 
                 WHERE (m.sender_id = $1 AND m.receiver_id = $2) OR (m.sender_id = $2 AND m.receiver_id = $1)
                 ORDER BY m.created_at ASC`;
        params = [currentUser, selected_user];
      } else if (selected_group) {
        query = `SELECT m.*, row_to_json(u.*) as sender 
                 FROM messages m 
                 JOIN users u ON m.sender_id = u.id 
                 WHERE m.group_id = $1
                 ORDER BY m.created_at ASC`;
        params = [selected_group];
      } else if (user_id && group_ids) {
        // Fetch all context messages
        const gIds = (group_ids as string).split(',').filter(x => x);
        const placeholders = gIds.map((_, i) => '$' + (i + 2)).join(',');
        
        if (gIds.length > 0) {
          query = `SELECT m.* FROM messages m WHERE m.sender_id = $1 OR m.receiver_id = $1 OR m.group_id IN (${placeholders}) ORDER BY m.created_at ASC`;
          params = [user_id, ...gIds];
        } else {
          query = `SELECT m.* FROM messages m WHERE m.sender_id = $1 OR m.receiver_id = $1 ORDER BY m.created_at ASC`;
          params = [user_id];
        }
      }
      
      if (!query) {
         res.json({ data: [] });
         return;
      }
      const result = await client.query(query, params);
      res.json({ data: result.rows });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    } finally {
      client.release();
    }
  });

  app.post('/v1/messages', requireAuth, async (req: Request, res: Response) => {
    const client = await pool.connect();
    try {
      const { id, content, sender_id, receiver_id, group_id } = req.body;
      const actualId = id || crypto.randomUUID();
      const result = await client.query(
        'INSERT INTO messages (id, content, sender_id, receiver_id, group_id) VALUES ($1, $2, $3, $4, $5) RETURNING *',
        [actualId, content, sender_id, receiver_id || null, group_id || null]
      );
      
      const newMsg = result.rows[0];
      
      // Emit via socket.io
      io.emit('postgres_changes', { new: newMsg });
      
      res.json({ data: newMsg });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    } finally {
      client.release();
    }
  });

  app.put('/v1/messages/read', requireAuth, async (req: Request, res: Response) => {
    const client = await pool.connect();
    try {
      const { message_ids } = req.body;
      if (message_ids && message_ids.length > 0) {
         const placeholders = message_ids.map((_:any, i:number) => '$' + (i + 1)).join(',');
         await client.query(`UPDATE messages SET is_read = true WHERE id IN (${placeholders})`, message_ids);
      }
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    } finally {
      client.release();
    }
  });

  app.delete('/v1/messages/conversation', requireAuth, async (req: Request, res: Response) => {
    const client = await pool.connect();
    try {
      const currentUser = (req as any).user.sub;
      const { direct_id, group_id } = req.body;
      
      if (direct_id) {
         await client.query(`DELETE FROM messages WHERE (sender_id = $1 AND receiver_id = $2) OR (sender_id = $2 AND receiver_id = $1)`, [currentUser, direct_id]);
      } else if (group_id) {
         await client.query(`DELETE FROM messages WHERE group_id = $1`, [group_id]);
      }
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    } finally {
      client.release();
    }
  });

  // ==========================================
  // PROJECT FILES (FACTURAS)
  // ==========================================
  app.get('/v1/project_files', requireAuth, async (req: Request, res: Response) => {
    const client = await pool.connect();
    try {
      const result = await client.query('SELECT * FROM project_files ORDER BY created_at DESC');
      res.json({ data: result.rows });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    } finally {
      client.release();
    }
  });

  app.post('/v1/project_files', requireAuth, async (req: Request, res: Response) => {
    const client = await pool.connect();
    try {
      const data = req.body;
      const result = await client.query(`
        INSERT INTO project_files (project_id, xml_file_name, xml_file_url, attachment_file_name, attachment_file_url, category, tags, comments, invoice_date)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *
      `, [data.project_id, data.xml_file_name, data.xml_file_url, data.attachment_file_name, data.attachment_file_url, data.category, JSON.stringify(data.tags || []), data.comments, data.invoice_date]);
      res.json({ data: result.rows[0] });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    } finally {
      client.release();
    }
  });

  app.delete('/v1/project_files/:id', requireAuth, async (req: Request, res: Response) => {
    const client = await pool.connect();
    try {
      await client.query('DELETE FROM project_files WHERE id = $1', [req.params.id]);
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    } finally {
      client.release();
    }
  });
  
  // Storage alternative for supabase.storage
  app.post('/v1/storage/upload', requireAuth, upload.single('file'), async (req: Request, res: Response) => {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    const url = getFileUrl(req.file);
    res.json({ url });
  });
}
