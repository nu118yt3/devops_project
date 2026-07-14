'use client';

import { useState, useEffect, useRef } from 'react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Pin, PinOff, Search, Users, Trash2, MoreVertical, MessageSquarePlus, ArrowLeft } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import supabase from '@/utils/supabase';

type User = {
  id: string;
  email?: string;
  full_name?: string;
  avatar_url?: string;
};

type Group = {
  id: string;
  name: string;
  avatar_url?: string;
  member_ids: string[];
};

type Conversation = {
  id: string; // user_id for direct, group_id for group
  type: 'direct' | 'group';
  direct_user?: User;
  group?: Group;
  last_message?: string;
  last_timestamp?: string;
  unread_count?: number;
  is_pinned?: boolean;
};

type Message = {
  id: string;
  content: string;
  created_at: string;
  sender_id: string;
  sender?: User;
  receiver_id?: string;
  group_id?: string;
  is_read?: boolean;
};

export default function ChatsPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [newMessage, setNewMessage] = useState('');
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [allUsers, setAllUsers] = useState<User[]>([]);

  // Dialog states
  const [isCreateGroupOpen, setIsCreateGroupOpen] = useState(false);
  const [isNewChatOpen, setIsNewChatOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  const [groupName, setGroupName] = useState('');
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Helper for Initials
  const getInitials = (nameOrEmail: string = '') => {
    const clean = nameOrEmail.trim();
    if (!clean) return '?';
    if (clean.includes('@')) {
      return (clean.split('@')[0][0] || '?').toUpperCase();
    }
    const parts = clean.split(' ').filter(p => p.length > 0);
    if (parts.length === 0) return '?';
    if (parts.length === 1) return parts[0][0].toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  // Fetch current user
  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const u: User = {
          id: user.id,
          email: user.email || '',
          full_name: user.user_metadata?.full_name,
          avatar_url: user.user_metadata?.avatar_url,
        };
        setCurrentUser(u);
      }
    };
    getUser();
  }, []);

  // Load all data
  useEffect(() => {
    if (!currentUser) return;

    const loadData = async () => {
      // 1. Load users
      const { data: users } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url')
        .neq('id', currentUser.id);

      setAllUsers(users || []);

      // 2. Load groups
      const { data: memberships } = await supabase
        .from('group_members')
        .select('group_id')
        .eq('user_id', currentUser.id);

      const groupIds = memberships?.map(m => m.group_id) || [];

      const { data: groups } = await supabase
        .from('groups')
        .select('id, name, avatar_url')
        .in('id', groupIds.length > 0 ? groupIds : ['00000000-0000-0000-0000-000000000000']);

      // 3. Load Pinned Conversations
      const { data: pinned } = await supabase
        .from('pinned_conversations')
        .select('conversation_id')
        .eq('user_id', currentUser.id);
      const pinnedIds = new Set(pinned?.map(p => p.conversation_id));

      // 4. Load ALL messages for context (Last message, Time, Unread)
      // Note: In a production app with millions of messages, you'd use a dedicated "conversations" table or materialized view.
      // For this scale, strictly fetching messages where I am sender or receiver is fine.

      const { data: allMessages } = await supabase
        .from('messages')
        .select('*')
        .or(`sender_id.eq.${currentUser.id},receiver_id.eq.${currentUser.id},group_id.in.(${groupIds.length > 0 ? groupIds.join(',') : '00000000-0000-0000-0000-000000000000'})`)
        .order('created_at', { ascending: true }); // Get latest last

      // Process messages to find latest per conversation
      const conversationStats = new Map<string, { lastMsg: string, lastTime: string, unread: number }>();

      allMessages?.forEach((msg: Message) => {
        // Determine conversation ID
        let convoId: string | undefined;
        if (msg.group_id) {
          convoId = msg.group_id;
        } else {
          // Direct message: The conversation ID is the OTHER person's ID
          convoId = msg.sender_id === currentUser.id ? msg.receiver_id : msg.sender_id;
        }

        if (convoId) {
          const currentStats = conversationStats.get(convoId) || { lastMsg: '', lastTime: '', unread: 0 };

          currentStats.lastMsg = msg.content;
          currentStats.lastTime = msg.created_at;

          // Check unread: If I am the receiver and it's not read
          // Assuming 'is_read' exists. If not, this logic effectively does nothing or defaults false.
          if (msg.receiver_id === currentUser.id && !msg.is_read) {
            currentStats.unread += 1;
          }
          // Reset unread if I sent the last message? No, unread is count of incoming. 
          // Usually distinct per user. Since we stream all messages, we can just count incoming unread.

          conversationStats.set(convoId, currentStats);
        }
      });


      // Build conversations List
      const convos: Conversation[] = [];

      // Direct chats - Only add if they have history OR are pinned
      if (users) {
        users.forEach((u: User) => {
          const stats = conversationStats.get(u.id);
          if (stats || pinnedIds.has(u.id)) {
            convos.push({
              id: u.id,
              type: 'direct',
              direct_user: u,
              last_message: stats?.lastMsg || 'No messages yet',
              last_timestamp: stats?.lastTime || new Date().toISOString(),
              unread_count: stats?.unread || 0,
              is_pinned: pinnedIds.has(u.id),
            });
          }
        });
      }

      // Group chats
      if (groups) {
        // Need member fetch inside loop or batch? Batch is better but simple loop is easier for now.
        // We do this async.
        const groupConvosPromises = groups.map(async (g) => {
          const { data: members } = await supabase
            .from('group_members')
            .select('user_id')
            .eq('group_id', g.id);

          const stats = conversationStats.get(g.id);
          return {
            id: g.id,
            type: 'group' as const,
            group: {
              id: g.id,
              name: g.name,
              avatar_url: g.avatar_url,
              member_ids: members?.map(m => m.user_id) || [],
            },
            last_message: stats?.lastMsg || 'Group created',
            last_timestamp: stats?.lastTime || new Date().toISOString(),
            unread_count: stats?.unread || 0,
            is_pinned: pinnedIds.has(g.id),
          };
        });

        const groupConvos = await Promise.all(groupConvosPromises);
        convos.push(...groupConvos);
      }

      // Sort by timestamp (newest first)
      convos.sort((a, b) => new Date(b.last_timestamp!).getTime() - new Date(a.last_timestamp!).getTime());

      setConversations(convos);
    };

    loadData();
  }, [currentUser]);

  // Use ref to access current selected conversation inside effect without re-subscribing
  const selectedConversationRef = useRef<Conversation | null>(null);
  useEffect(() => {
    selectedConversationRef.current = selectedConversation;
  }, [selectedConversation]);

  // Global Realtime Subscription
  useEffect(() => {
    if (!currentUser) return;

    const channel = supabase
      .channel('global-chats')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
      }, (payload) => {
        const newMsg = payload.new as Message;
        const currentSelected = selectedConversationRef.current;

        // 1. Update Messages Area if open
        if (currentSelected && (
          (currentSelected.type === 'direct' && (newMsg.sender_id === currentSelected.id || newMsg.receiver_id === currentSelected.id)) ||
          (currentSelected.type === 'group' && newMsg.group_id === currentSelected.id)
        )) {
          setMessages(prev => {
            // Precise dedup using ID (now consistent)
            if (prev.some(m => m.id === newMsg.id)) return prev;

            let sender = newMsg.sender_id === currentUser.id ? currentUser : allUsers.find(u => u.id === newMsg.sender_id);
            const msgWithSender: Message = { ...newMsg, sender: sender };
            return [...prev, msgWithSender];
          });
        }

        // 2. Update Sidebar List
        setConversations(prev => {
          let found = false;
          const updated = prev.map(c => {
            const isMatch = (c.type === 'group' && c.id === newMsg.group_id) ||
              (c.type === 'direct' && (c.id === newMsg.sender_id || c.id === newMsg.receiver_id));

            if (isMatch) {
              found = true;
              // Increment unread count if:
              // 1. I am NOT the sender AND
              // 2. It's NOT the currently selected conversation
              const shouldIncrement = newMsg.sender_id !== currentUser.id && (!currentSelected || currentSelected.id !== c.id);

              return {
                ...c,
                last_message: newMsg.content,
                last_timestamp: newMsg.created_at,
                unread_count: shouldIncrement ? (c.unread_count || 0) + 1 : c.unread_count
              };
            }
            return c;
          });

          if (!found) {
            // New conversation started by someone else?
            if (newMsg.receiver_id === currentUser.id) {
              const sender = allUsers.find(u => u.id === newMsg.sender_id);
              if (sender) {
                const newConvo: Conversation = {
                  id: sender.id,
                  type: 'direct',
                  direct_user: sender,
                  last_message: newMsg.content,
                  last_timestamp: newMsg.created_at,
                  unread_count: 1, // First message is surely unread
                  is_pinned: false
                };
                return [newConvo, ...updated];
              }
            }
          }

          return updated.sort((a, b) => new Date(b.last_timestamp!).getTime() - new Date(a.last_timestamp!).getTime());
        });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUser, allUsers]); // Removed selectedConversation from deps

  // Load messages for selected conversation
  useEffect(() => {
    if (!selectedConversation || !currentUser) {
      setMessages([]);
      return;
    }

    const loadMessages = async () => {
      let filter;
      if (selectedConversation.type === 'direct') {
        const otherId = selectedConversation.id;
        filter = supabase
          .from('messages')
          .select('*, sender:profiles!messages_sender_id_fkey(id, full_name, avatar_url)')
          .or(
            `and(sender_id.eq.${currentUser.id},receiver_id.eq.${otherId}),` +
            `and(sender_id.eq.${otherId},receiver_id.eq.${currentUser.id})`
          );
      } else {
        filter = supabase
          .from('messages')
          .select('*, sender:profiles!messages_sender_id_fkey(id, full_name, avatar_url)')
          .eq('group_id', selectedConversation.id);
      }

      const { data } = await filter.order('created_at', { ascending: true });
      setMessages(data || []);

      // Clear unread count locally when opened
      setConversations(prev => prev.map(c =>
        c.id === selectedConversation.id ? { ...c, unread_count: 0 } : c
      ));

      // Mark as read in DB
      if (data && data.length > 0) {
        const unreadIds = data.filter((m: Message) => m.receiver_id === currentUser.id && !m.is_read).map((m: Message) => m.id);
        if (unreadIds.length > 0) {
          await supabase.from('messages').update({ is_read: true }).in('id', unreadIds);
        }
      }
    };

    loadMessages();
  }, [selectedConversation, currentUser]);

  // Auto scroll
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedConversation || !currentUser) return;

    // 1. Optimistic Updates
    const tempId = crypto.randomUUID();
    const content = newMessage;
    const timestamp = new Date().toISOString();

    const optimisticMsg: Message = {
      id: tempId,
      content: content,
      created_at: timestamp,
      sender_id: currentUser.id,
      sender: currentUser,
      receiver_id: selectedConversation.type === 'direct' ? selectedConversation.id : undefined,
      group_id: selectedConversation.type === 'group' ? selectedConversation.id : undefined
    };

    setMessages(prev => [...prev, optimisticMsg]);
    setNewMessage('');

    setConversations(prev => {
      const updated = prev.map(c => {
        if (c.id === selectedConversation.id) {
          return { ...c, last_message: content, last_timestamp: timestamp };
        }
        return c;
      });
      return updated.sort((a, b) => new Date(b.last_timestamp!).getTime() - new Date(a.last_timestamp!).getTime());
    });

    // 2. Perform DB Insert with the SAME ID
    if (selectedConversation.type === 'direct') {
      await supabase.from('messages').insert({
        id: tempId, // Important for deduplication
        content: content,
        sender_id: currentUser.id,
        receiver_id: selectedConversation.id,
      });
    } else {
      await supabase.from('messages').insert({
        id: tempId, // Important for deduplication
        content: content,
        sender_id: currentUser.id,
        group_id: selectedConversation.id,
      });
    }
  };

  const startNewDirectChat = (user: User) => {
    // Check if already exists
    const existing = conversations.find(c => c.id === user.id && c.type === 'direct');
    if (existing) {
      setSelectedConversation(existing);
    } else {
      // Add temporary conversation
      const newConvo: Conversation = {
        id: user.id,
        type: 'direct',
        direct_user: user,
        last_message: 'Draft',
        last_timestamp: new Date().toISOString(),
        unread_count: 0,
        is_pinned: false
      };
      setConversations(prev => [newConvo, ...prev]);
      setSelectedConversation(newConvo);
    }
    setIsNewChatOpen(false);
  };

  const createGroup = async () => {
    if (!groupName.trim() || selectedMembers.length < 1) return;

    const members = [currentUser!.id, ...selectedMembers];

    const { data: group } = await supabase
      .from('groups')
      .insert({ name: groupName, created_by: currentUser!.id })
      .select()
      .single();

    if (group) {
      await supabase.from('group_members').insert(
        members.map(user_id => ({ group_id: group.id, user_id }))
      );

      const newConvo: Conversation = {
        id: group.id,
        type: 'group',
        group: {
          id: group.id,
          name: groupName,
          member_ids: members,
        },
        last_message: 'Group created',
        last_timestamp: new Date().toISOString(),
        is_pinned: false,
      };

      setConversations(prev => [newConvo, ...prev]);
      setSelectedConversation(newConvo);

      setIsCreateGroupOpen(false);
      setGroupName('');
      setSelectedMembers([]);
    }
  };

  const togglePin = async (conv: Conversation) => {
    if (!currentUser) return;

    const newPinnedStatus = !conv.is_pinned;

    setConversations(prev => prev.map(c =>
      c.id === conv.id ? { ...c, is_pinned: newPinnedStatus } : c
    ));

    try {
      if (newPinnedStatus) {
        await supabase.from('pinned_conversations').insert({
          user_id: currentUser.id,
          conversation_id: conv.id,
          type: conv.type
        });
      } else {
        await supabase.from('pinned_conversations').delete()
          .eq('user_id', currentUser.id)
          .eq('conversation_id', conv.id);
      }
    } catch (err) {
      console.error("Error toggling pin", err);
      // Revert
      setConversations(prev => prev.map(c =>
        c.id === conv.id ? { ...c, is_pinned: !newPinnedStatus } : c
      ));
    }
  };

  const deleteConversation = async () => {
    if (!selectedConversation || !currentUser) return;
    if (!selectedConversation || !currentUser) return;

    try {
      if (selectedConversation.type === 'direct') {
        await supabase.from('messages').delete().or(
          `and(sender_id.eq.${currentUser.id},receiver_id.eq.${selectedConversation.id}),` +
          `and(sender_id.eq.${selectedConversation.id},receiver_id.eq.${currentUser.id})`
        );
      } else {
        await supabase.from('messages').delete().eq('group_id', selectedConversation.id);
      }

      setMessages([]);
      // Remove from list instead of just clearing text
      setConversations(prev => prev.filter(c => c.id !== selectedConversation.id));
      setSelectedConversation(null);

    } catch (err) {
      console.error("Error deleting conversation", err);
      alert("Failed to delete conversation");
    } finally {
      setIsDeleteDialogOpen(false);
    }
  };


  const filteredConversations = conversations.filter(conv => {
    if (conv.type === 'direct') {
      const name = conv.direct_user?.full_name || conv.direct_user?.email || '';
      return name.toLowerCase().includes(searchQuery.toLowerCase());
    } else {
      return conv.group?.name.toLowerCase().includes(searchQuery.toLowerCase());
    }
  });

  const getConversationTitle = (conv: Conversation) => {
    return conv.type === 'direct'
      ? conv.direct_user?.full_name || conv.direct_user?.email || 'Unknown'
      : conv.group?.name || 'Group Chat';
  };

  const getConversationAvatar = (conv: Conversation) => {
    if (conv.type === 'direct') {
      const title = getConversationTitle(conv);
      return (
        <Avatar>
          <AvatarImage src={conv.direct_user?.avatar_url} />
          <AvatarFallback>{getInitials(title)}</AvatarFallback>
        </Avatar>
      );
    } else {
      return (
        <div className="relative">
          <Avatar>
            <AvatarImage src={conv.group?.avatar_url} />
            <AvatarFallback className="bg-primary/10">
              <Users className="h-5 w-5" />
            </AvatarFallback>
          </Avatar>
          {conv.group?.member_ids.length! > 3 && (
            <Badge className="absolute -bottom-1 -right-1 text-xs" variant="secondary">
              +{conv.group?.member_ids.length! - 3}
            </Badge>
          )}
        </div>
      );
    }
  };

  return (
    <div className="flex h-[calc(97vh-2rem)] bg-background overflow-hidden border-t">
      {/* Conversations List */}
      <div className={`w-full md:w-80 lg:w-96 border-r border-border flex flex-col h-full ${selectedConversation ? 'hidden md:flex' : 'flex'}`}>
        <div className="p-4 border-b border-border">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl font-semibold">Messages</h1>
            <div className="flex gap-2">
              {/* Create Group Dialog */}
              <Dialog open={isCreateGroupOpen} onOpenChange={setIsCreateGroupOpen}>
                <DialogTrigger asChild>
                  <Button size="icon" variant="outline" title="New Group">
                    <Users className="h-4 w-4" />
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Create Group Chat</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div>
                      <Label>Group Name</Label>
                      <Input
                        value={groupName}
                        onChange={(e) => setGroupName(e.target.value)}
                        placeholder="e.g. Design System Sync"
                      />
                    </div>
                    <div>
                      <Label>Members</Label>
                      <ScrollArea className="h-64 border rounded-md p-2">
                        {allUsers.map(user => (
                          <div key={user.id} className="flex items-center space-x-3 py-2">
                            <Checkbox
                              checked={selectedMembers.includes(user.id)}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  setSelectedMembers([...selectedMembers, user.id]);
                                } else {
                                  setSelectedMembers(selectedMembers.filter(id => id !== user.id));
                                }
                              }}
                            />
                            <Avatar className="h-8 w-8">
                              <AvatarImage src={user.avatar_url} />
                              <AvatarFallback>{getInitials(user.full_name || user.email)}</AvatarFallback>
                            </Avatar>
                            <span className="text-sm">{user.full_name || user.email?.split('@')[0]}</span>
                          </div>
                        ))}
                      </ScrollArea>
                    </div>
                    <Button onClick={createGroup} disabled={!groupName || selectedMembers.length === 0}>
                      Create Group
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>

              {/* Start Chat Dialog */}
              <Dialog open={isNewChatOpen} onOpenChange={setIsNewChatOpen}>
                <DialogTrigger asChild>
                  <Button size="icon" title="New Chat">
                    <MessageSquarePlus className="h-4 w-4" />
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>New Message</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-2 py-4">
                    <Input placeholder="Search users..." className="mb-2" />
                    <ScrollArea className="h-72">
                      {allUsers.map(user => (
                        <div
                          key={user.id}
                          className="flex items-center gap-3 p-2 hover:bg-accent rounded-md cursor-pointer"
                          onClick={() => startNewDirectChat(user)}
                        >
                          <Avatar className="h-10 w-10">
                            <AvatarImage src={user.avatar_url} />
                            <AvatarFallback>{getInitials(user.full_name || user.email)}</AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="text-sm font-medium">{user.full_name || user.email}</p>
                          </div>
                        </div>
                      ))}
                    </ScrollArea>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                <AlertDialogDescription>
                  This action cannot be undone. This will permanently delete this conversation and remove it from your list.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={deleteConversation} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <div className="relative mb-4">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Filter chats..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 h-10"
            />
          </div>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-3 space-y-4">
            {/* Pinned */}
            {filteredConversations.some(c => c.is_pinned) && (
              <div className="space-y-2">
                <h2 className="text-xs font-semibold text-muted-foreground px-2 uppercase tracking-wider">Pinned</h2>
                {filteredConversations.filter(c => c.is_pinned).map(conv => (
                  <div
                    key={conv.id}
                    className={`flex items-center gap-3 p-3 rounded-lg hover:bg-accent cursor-pointer transition-colors ${selectedConversation?.id === conv.id ? 'bg-accent' : ''}`}
                    onClick={() => setSelectedConversation(conv)}
                  >
                    <div className="relative">
                      {getConversationAvatar(conv)}
                      <div className="absolute -top-1 -right-1 bg-primary text-primary-foreground rounded-full p-[2px]">
                        <Pin className="h-2 w-2" />
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className="font-medium truncate text-sm">{getConversationTitle(conv)}</p>
                        <span className="text-[10px] text-muted-foreground whitespace-nowrap ml-2">
                          {conv.last_timestamp ? new Date(conv.last_timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground truncate">{conv.last_message}</p>
                    </div>
                    {conv.unread_count ? <Badge variant="destructive" className="px-1.5 h-5 text-[10px]">{conv.unread_count}</Badge> : null}
                  </div>
                ))}
              </div>
            )}

            {/* Recent */}
            <div className="space-y-2">
              <h2 className="text-xs font-semibold text-muted-foreground px-2 uppercase tracking-wider">Recent</h2>
              {filteredConversations.length === 0 ? (
                <div className="text-center py-8 px-4 text-muted-foreground text-sm">
                  <p>No conversations yet.</p>
                  <Button variant="link" onClick={() => setIsNewChatOpen(true)}>Start a new chat</Button>
                </div>
              ) : filteredConversations.filter(c => !c.is_pinned).map(conv => (
                <div
                  key={conv.id}
                  className={`flex items-center gap-3 p-3 rounded-lg hover:bg-accent cursor-pointer transition-colors ${selectedConversation?.id === conv.id ? 'bg-accent' : ''}`}
                  onClick={() => setSelectedConversation(conv)}
                >
                  {getConversationAvatar(conv)}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="font-medium truncate text-sm">{getConversationTitle(conv)}</p>
                      <span className="text-[10px] text-muted-foreground whitespace-nowrap ml-2">
                        {conv.last_timestamp ? new Date(conv.last_timestamp).toLocaleDateString(undefined, { weekday: 'short', hour: '2-digit', minute: '2-digit' }) : ''}
                      </span>
                    </div>
                    <p className={`text-xs truncate ${conv.unread_count ? 'font-semibold text-foreground' : 'text-muted-foreground'}`}>{conv.last_message}</p>
                  </div>
                  {conv.unread_count ? <Badge variant="destructive" className="px-1.5 h-5 text-[10px]">{conv.unread_count}</Badge> : null}
                </div>
              ))}
            </div>
          </div>
        </ScrollArea>
      </div>

      {selectedConversation ? (
        <div className={`flex-1 flex-col h-full bg-slate-50/50 dark:bg-slate-900/50 relative overflow-hidden ${selectedConversation ? 'flex' : 'hidden md:flex'}`}>
          <div className="p-4 border-b border-border bg-background flex items-center justify-between shadow-sm z-30 relative">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" className="md:hidden -ml-2" onClick={() => setSelectedConversation(null)}>
                <ArrowLeft className="h-5 w-5" />
              </Button>
              {getConversationAvatar(selectedConversation)}
              <div>
                <p className="font-semibold">{getConversationTitle(selectedConversation)}</p>
                <p className="text-xs text-muted-foreground">
                  {selectedConversation.type === 'group'
                    ? `${selectedConversation.group?.member_ids.length} members`
                    : ''}
                </p>
              </div>
            </div>

            {/* Actions Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => togglePin(selectedConversation)}>
                  {selectedConversation.is_pinned ? (
                    <><PinOff className="mr-2 h-4 w-4" /> Unpin Chat</>
                  ) : (
                    <><Pin className="mr-2 h-4 w-4" /> Pin Chat</>
                  )}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setIsDeleteDialogOpen(true)} className="text-red-500 focus:text-red-500 hover:text-red-600 focus:bg-red-50 dark:focus:bg-red-950/20">
                  <Trash2 className="mr-2 h-4 w-4" /> Delete Conversation
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <ScrollArea className="flex-1 p-4 pb-20" ref={scrollRef}>
            <div className="max-w-3xl mx-auto space-y-4 pb-4">
              {messages.length === 0 && (
                <div className="text-center py-10 text-muted-foreground text-sm">
                  No messages yet. Start the conversation!
                </div>
              )}
              {messages.map(msg => (
                <div
                  key={msg.id}
                  className={`flex ${msg.sender_id === currentUser?.id ? 'justify-end' : 'justify-start'}`}
                >
                  {msg.sender_id !== currentUser?.id && (
                    <Avatar className="mr-3 mt-1 h-8 w-8 ring-2 ring-background">
                      <AvatarImage src={msg.sender?.avatar_url} />
                      <AvatarFallback>{getInitials(msg.sender?.full_name || msg.sender?.email)}</AvatarFallback>
                    </Avatar>
                  )}
                  <div className="flex flex-col max-w-[75%]">
                    {msg.sender_id !== currentUser?.id && (
                      <span className="text-[10px] text-muted-foreground mb-1 ml-1 opacity-70">
                        {msg.sender?.full_name || msg.sender?.email}
                      </span>
                    )}
                    <div className={`px-4 py-2 rounded-2xl text-sm shadow-sm ${msg.sender_id === currentUser?.id
                      ? 'bg-primary text-primary-foreground rounded-br-sm'
                      : 'bg-white dark:bg-muted text-foreground rounded-bl-sm border border-border/50'
                      }`}>
                      <p>{msg.content}</p>
                    </div>
                    <span className={`text-[9px] text-muted-foreground mt-1 px-1 ${msg.sender_id === currentUser?.id ? 'text-right' : 'text-left'}`}>
                      {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>

          <div className="absolute bottom-0 left-0 w-full p-4 border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 z-20">
            <div className="max-w-3xl mx-auto flex gap-2 w-full">
              <Input
                placeholder="Type a message..."
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                className="flex-1"
                autoFocus
              />
              <Button onClick={sendMessage}>Send</Button>
            </div>
          </div>
        </div>
      ) : (
        <div className="hidden md:flex flex-1 flex-col items-center justify-center text-muted-foreground bg-slate-50/50 dark:bg-slate-900/50">
          <div className="p-8 rounded-full bg-muted/50 mb-4">
            <Users className="h-12 w-12 opacity-50" />
          </div>
          <p className="font-medium">Pick a conversation</p>
          <p className="text-sm opacity-70 mt-1">Or create a new one to start chatting</p>
          <Button variant="outline" className="mt-4" onClick={() => setIsNewChatOpen(true)}>Start New Chat</Button>
        </div>
      )}
    </div>
  );
}