import { useEffect, useState } from 'react';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../../amplify/data/resource';
import { MessageSquare, Send } from 'lucide-react';
import { format, parseISO } from 'date-fns';

const client = generateClient<Schema>();

export default function MyMessages() {
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [gigId, setGigId] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        // Get customer's gigs to find gigId for messages
        const { data: gigs } = await client.models.Gig.list({ limit: 10 });
        if (gigs && gigs.length > 0) {
          const gig = gigs[0]; // Use most recent gig
          setGigId(gig.id);
          // Load messages for this gig
          const { data: msgs } = await client.models.Message.list({
            filter: { gigId: { eq: gig.id } }
          });
          setMessages((msgs || []).sort((a: any, b: any) =>
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
          ));
        }
      } catch (err) {
        console.error('Failed to load messages:', err);
      } finally {
        setLoading(false);
      }
    }
    load();

    // Real-time subscription
    const sub = client.models.Message.observeQuery().subscribe({
      next: ({ items }) => {
        const sorted = items.sort((a: any, b: any) =>
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        );
        setMessages(sorted);
      }
    });
    return () => sub.unsubscribe();
  }, []);

  const sendMessage = async () => {
    if (!newMessage.trim() || !gigId) return;
    setSending(true);
    try {
      await client.models.Message.create({
        gigId,
        senderId: 'customer',
        senderRole: 'customer',
        senderName: 'You',
        content: newMessage.trim(),
        readBy: [],
      });
      setNewMessage('');
    } catch (err) {
      console.error('Failed to send:', err);
    } finally {
      setSending(false);
    }
  };

  if (loading) return <div className="text-ace-muted text-center py-12">Loading messages...</div>;

  if (!gigId) {
    return (
      <div className="text-center py-16">
        <MessageSquare size={48} className="text-ace-muted mx-auto mb-4" />
        <h2 className="text-xl font-semibold mb-2">No Active Booking</h2>
        <p className="text-ace-muted">Messages will be available once you have a confirmed booking.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-200px)]">
      <h2 className="text-xl font-bold mb-4">Messages</h2>
      <p className="text-sm text-ace-muted mb-4">Chat with the ACE team about your event.</p>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-3 mb-4">
        {messages.length === 0 ? (
          <div className="text-center text-ace-muted text-sm py-8">
            No messages yet. Send one to start the conversation.
          </div>
        ) : (
          messages.map(msg => (
            <div
              key={msg.id}
              className={`max-w-[80%] ${msg.senderRole === 'customer' ? 'ml-auto' : ''}`}
            >
              <div className={`rounded-xl px-4 py-3 ${
                msg.senderRole === 'customer'
                  ? 'bg-ace-purple/20 border border-ace-purple/30'
                  : 'bg-[#1e1e1e] border border-[rgba(255,255,255,0.06)]'
              }`}>
                {msg.senderRole !== 'customer' && (
                  <span className="text-xs text-ace-cyan font-medium block mb-1">{msg.senderName}</span>
                )}
                <p className="text-sm">{msg.content}</p>
              </div>
              <span className="text-xs text-ace-muted mt-1 block px-1">
                {msg.createdAt && format(parseISO(msg.createdAt), 'MMM d, h:mm a')}
              </span>
            </div>
          ))
        )}
      </div>

      {/* Input */}
      <div className="flex gap-2">
        <input
          type="text"
          className="input flex-1"
          placeholder="Type a message..."
          value={newMessage}
          onChange={e => setNewMessage(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && sendMessage()}
        />
        <button onClick={sendMessage} disabled={sending || !newMessage.trim()} className="btn-primary px-4">
          <Send size={18} />
        </button>
      </div>
    </div>
  );
}
