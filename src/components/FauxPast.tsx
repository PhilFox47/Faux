import React, { useState, useEffect } from 'react';
import { Calendar, ArrowLeft, Trophy, MessageSquare, Users, Heart, Image as ImageIcon, BookOpen } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export function FauxPast() {
  const [recaps, setRecaps] = useState<any[]>([]);
  const [selectedRecap, setSelectedRecap] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRecaps();
  }, []);

  const fetchRecaps = async () => {
    try {
      const res = await fetch('/api/recaps');
      const data = await res.json();
      setRecaps(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const fetchRecapDetails = async (monthYear: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/recaps/${monthYear}`);
      const data = await res.json();
      setSelectedRecap(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  if (loading && !recaps.length) {
    return <div className="p-8 text-center text-gray-500">Loading FauxPast...</div>;
  }

  if (selectedRecap) {
    const { data } = selectedRecap;
    return (
      <div className="p-6 max-w-4xl mx-auto pb-20">
        <button 
          onClick={() => setSelectedRecap(null)}
          className="mb-6 flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
        >
          <ArrowLeft size={20} /> Back to FauxPast
        </button>

        <div className="text-center mb-12">
          <h1 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-pink-500 mb-2">
            {selectedRecap.title}
          </h1>
          <p className="text-xl text-gray-400 font-medium">
            {new Date(selectedRecap.month_year + '-01').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })} Recap
          </p>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
          <StatCard icon={<MessageSquare />} label="Total Posts" value={data.stats.totalPosts} color="text-blue-400" />
          <StatCard icon={<MessageSquare />} label="Total Comments" value={data.stats.totalComments} color="text-green-400" />
          <StatCard icon={<Users />} label="New Characters" value={data.stats.totalJoinedCharacters} color="text-purple-400" />
          <StatCard icon={<Heart />} label="New Relationships" value={data.stats.totalRelationships} color="text-pink-400" />
        </div>

        {/* Graphs */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 mb-12">
          <h2 className="text-2xl font-bold mb-6">Activity Over Time</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.daily.posts}>
                <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                <XAxis dataKey="date" stroke="#888" tickFormatter={(val) => val.split('-')[2]} />
                <YAxis stroke="#888" />
                <Tooltip contentStyle={{ backgroundColor: '#18181b', border: '1px solid #27272a' }} />
                <Line type="monotone" dataKey="count" name="Posts" stroke="#f97316" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Leaderboards */}
        <div className="space-y-12 mb-12">
          <Podium title="The Chatterboxes" subtitle="Most Posts Created" data={data.leaderboards.topPosters} />
          <Podium title="The Reply Guys" subtitle="Most Comments Created" data={data.leaderboards.topCommenters} />
          <Podium title="The Main Characters" subtitle="Most Comments Received" data={data.leaderboards.topCommentReceivers} />
          <Podium title="The Rising Stars" subtitle="Most Followers Earned" data={data.leaderboards.topFollowersEarned} />
          <Podium title="The Social Butterflies" subtitle="Most Relationships Formed" data={data.leaderboards.topRelationshipsFormed} />
          <Podium title="The Human Whisperers" subtitle="Most Interactions with Real Users" data={data.leaderboards.topRealUserInteractions} />
        </div>

        {/* Arcs */}
        {data.arcs && data.arcs.length > 0 && (
          <div className="mb-12">
            <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
              <BookOpen className="text-orange-500" /> Completed Arcs
            </h2>
            <div className="grid gap-4 md:grid-cols-2">
              {data.arcs.map((arc: any, i: number) => (
                <div key={i} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                  <h3 className="font-bold text-lg mb-2 text-orange-400">{arc.title}</h3>
                  <p className="text-gray-300 text-sm leading-relaxed">{arc.completion_summary}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Images Carousel */}
        {data.images && data.images.length > 0 && (
          <div>
            <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
              <ImageIcon className="text-orange-500" /> Memories
            </h2>
            <div className="flex overflow-x-auto gap-4 pb-4 custom-scrollbar snap-x">
              {data.images.map((url: string, i: number) => (
                <div key={i} className="flex-shrink-0 w-64 h-64 rounded-xl overflow-hidden snap-center border border-zinc-800">
                  <img src={url} alt="" className="w-full h-full object-cover" />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-8">
        <Calendar className="text-orange-500 w-8 h-8" />
        <h1 className="text-3xl font-bold">FauxPast</h1>
      </div>
      <p className="text-gray-400 mb-8 text-lg">
        Take a look back at the history of Faux. Select a month to view its recap.
      </p>

      {recaps.length === 0 ? (
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 text-center">
          <p className="text-gray-400">No recaps available yet. Check back later!</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {recaps.map(recap => (
            <button
              key={recap.id}
              onClick={() => fetchRecapDetails(recap.month_year)}
              className="bg-zinc-900 border border-zinc-800 hover:border-orange-500/50 rounded-2xl p-6 text-left transition-all hover:-translate-y-1 group"
            >
              <div className="text-sm text-orange-500 font-bold mb-2">
                {new Date(recap.month_year + '-01').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
              </div>
              <h3 className="text-xl font-bold text-white group-hover:text-orange-400 transition-colors line-clamp-2">
                {recap.title}
              </h3>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function StatCard({ icon, label, value, color }: { icon: React.ReactNode, label: string, value: number, color: string }) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 flex flex-col items-center justify-center text-center">
      <div className={`mb-2 ${color}`}>{icon}</div>
      <div className="text-3xl font-black mb-1">{value.toLocaleString()}</div>
      <div className="text-xs text-gray-400 uppercase tracking-wider font-bold">{label}</div>
    </div>
  );
}

function Podium({ title, subtitle, data }: { title: string, subtitle: string, data: any[] }) {
  if (!data || data.length === 0) return null;

  // Ensure we have exactly 5 items for the podium layout, pad with nulls if needed
  const paddedData = [...data];
  while (paddedData.length < 5) paddedData.push(null);

  // Reorder for podium: 4, 2, 1, 3, 5
  const podiumOrder = [paddedData[3], paddedData[1], paddedData[0], paddedData[2], paddedData[4]];
  const heights = ['h-24', 'h-32', 'h-40', 'h-28', 'h-20'];
  const ranks = [4, 2, 1, 3, 5];
  const colors = [
    'bg-zinc-800', // 4th
    'bg-zinc-300 text-zinc-900', // 2nd (Silver)
    'bg-yellow-500 text-yellow-900', // 1st (Gold)
    'bg-orange-700 text-orange-100', // 3rd (Bronze)
    'bg-zinc-800' // 5th
  ];

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-black text-white mb-1">{title}</h2>
        <p className="text-gray-400">{subtitle}</p>
      </div>

      <div className="flex items-end justify-center gap-2 md:gap-4 h-64 mt-12">
        {podiumOrder.map((user, index) => (
          <div key={index} className="flex flex-col items-center w-16 md:w-24">
            {user && (
              <div className="flex flex-col items-center mb-2 animate-fade-in-up" style={{ animationDelay: `${index * 100}ms` }}>
                <div className="w-12 h-12 md:w-16 md:h-16 rounded-full overflow-hidden border-2 border-zinc-700 mb-2">
                  <img src={user.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.display_name}`} alt="" className="w-full h-full object-cover bg-zinc-800" />
                </div>
                <div className="text-xs md:text-sm font-bold text-center truncate w-full px-1">{user.display_name}</div>
                <div className="text-xs text-orange-400 font-bold">{user.count.toLocaleString()}</div>
              </div>
            )}
            <div className={`w-full rounded-t-lg flex items-start justify-center pt-2 font-black text-xl ${heights[index]} ${colors[index]}`}>
              {ranks[index]}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
