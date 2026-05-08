import { useState, useEffect, useMemo } from 'react';
import { 
  Users, 
  BarChart3, 
  Trash2, 
  Plus, 
  Search, 
  ChevronRight, 
  X, 
  Save, 
  User,
  DollarSign,
  TrendingUp,
  CreditCard,
  Loader2
} from 'lucide-react';
import { 
  getLeads, 
  saveLead, 
  deleteLead, 
  getTrash, 
  getStatusColor, 
  getStatusLabel, 
  calculateTotalRevenue
} from '../utils/crmStorage';
import type { Lead, LeadStatus } from '../utils/crmStorage';
import { format } from 'date-fns';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell,
  Legend
} from 'recharts';

type Tab = 'leads' | 'analytics' | 'trash';

export default function CrmPage() {
  const [activeTab, setActiveTab] = useState<Tab>('leads');
  const [leads, setLeads] = useState<Lead[]>([]);
  const [trash, setTrash] = useState<Lead[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    refreshData();
  }, [activeTab]);

  const refreshData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'trash') {
        const data = await getTrash();
        setTrash(data);
      } else {
        const data = await getLeads();
        setLeads(data);
      }
    } catch (err) {
      console.error('Error fetching data:', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredLeads = useMemo(() => {
    const list = activeTab === 'trash' ? trash : leads;
    return list.filter(l => 
      l.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
      l.phone.includes(searchQuery) ||
      l.language.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [leads, trash, searchQuery, activeTab]);

  const stats = useMemo(() => {
    const totalLeads = leads.length;
    const clients = leads.filter(l => l.status === 'client');
    const totalClients = clients.length;
    const totalRevenue = leads.reduce((acc, l) => acc + calculateTotalRevenue(l), 0);
    const conversionRate = totalLeads ? (totalClients / totalLeads * 100).toFixed(1) : 0;
    
    const statusData = [
      { name: 'Νέα', value: leads.filter(l => l.status === 'new').length, color: '#3b82f6' },
      { name: 'Ραντεβού', value: leads.filter(l => l.status === 'appointment').length, color: '#a855f7' },
      { name: 'Πελάτες', value: totalClients, color: '#22c55e' },
      { name: 'Απορρίψεις', value: leads.filter(l => l.status === 'rejected').length, color: '#ef4444' },
    ];

    const revenueData = [
      { name: 'Jan', value: totalRevenue * 0.4 },
      { name: 'Feb', value: totalRevenue * 0.6 },
      { name: 'Mar', value: totalRevenue * 0.8 },
      { name: 'Apr', value: totalRevenue },
    ];

    return { totalLeads, totalClients, totalRevenue, conversionRate, statusData, revenueData };
  }, [leads]);

  const handleSaveLead = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const leadData: Partial<Lead> = {
      id: selectedLead?.id,
      name: formData.get('name') as string,
      phone: formData.get('phone') as string,
      audience: formData.get('audience') as string,
      language: formData.get('language') as string,
      status: formData.get('status') as LeadStatus,
      notes: formData.get('notes') as string,
      monthly_subscription: Number(formData.get('monthly_subscription')) || undefined,
      start_date: formData.get('start_date') as string || undefined,
    };
    
    try {
      await saveLead(leadData);
      await refreshData();
      setIsModalOpen(false);
      setSelectedLead(null);
    } catch (err) {
      alert('Error saving lead');
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('Είστε σίγουροι ότι θέλετε να διαγράψετε αυτό το lead;')) {
      try {
        await deleteLead(id);
        await refreshData();
        setIsModalOpen(false);
      } catch (err) {
        alert('Error deleting lead');
      }
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex" style={{ fontFamily: 'Manrope, sans-serif' }}>
      {/* Sidebar */}
      <aside className="w-64 bg-[#2B2520] text-white flex flex-col">
        <div className="p-6 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#ff8d01] rounded-lg flex items-center justify-center font-bold text-xl">SE</div>
            <div>
              <h1 className="font-bold text-lg leading-none">SoEasy</h1>
              <p className="text-xs opacity-50 mt-1">CRM Dashboard</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-2">
          <button 
            onClick={() => setActiveTab('leads')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${activeTab === 'leads' ? 'bg-[#ff8d01] text-white' : 'hover:bg-white/5 opacity-70 hover:opacity-100'}`}
          >
            <Users size={20} />
            <span className="font-medium">Leads</span>
          </button>
          <button 
            onClick={() => setActiveTab('analytics')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${activeTab === 'analytics' ? 'bg-[#ff8d01] text-white' : 'hover:bg-white/5 opacity-70 hover:opacity-100'}`}
          >
            <BarChart3 size={20} />
            <span className="font-medium">Analytics</span>
          </button>
          <button 
            onClick={() => setActiveTab('trash')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${activeTab === 'trash' ? 'bg-[#ff8d01] text-white' : 'hover:bg-white/5 opacity-70 hover:opacity-100'}`}
          >
            <Trash2 size={20} />
            <span className="font-medium">Κάδος</span>
          </button>
        </nav>

        <div className="p-6 border-t border-white/10 text-[10px] opacity-40">
          Designed & Developed by <br />
          <a href="https://adigitalagency.gr" target="_blank" rel="noreferrer" className="underline hover:text-[#ff8d01]">ADIGITAL Marketing</a>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col">
        <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-8">
          <div className="flex items-center gap-4">
            <h2 className="text-xl font-bold capitalize">{activeTab}</h2>
            {loading && <Loader2 className="animate-spin text-primary" size={20} />}
          </div>
          
          <div className="flex items-center gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input 
                type="text" 
                placeholder="Αναζήτηση..." 
                className="pl-10 pr-4 py-2 bg-gray-100 rounded-full border-none focus:ring-2 focus:ring-[#ff8d01] text-sm w-64"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <button 
              onClick={() => {
                setSelectedLead(null);
                setIsEditing(true);
                setIsModalOpen(true);
              }}
              className="flex items-center gap-2 bg-[#ff8d01] text-white px-4 py-2 rounded-lg hover:opacity-90 transition-all font-bold text-sm"
            >
              <Plus size={18} />
              Προσθήκη Lead
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-auto p-8">
          {activeTab === 'analytics' ? (
            <div className="space-y-8">
              {/* Stats Grid */}
              <div className="grid grid-cols-4 gap-6">
                {[
                  { label: 'Συνολικά Leads', value: stats.totalLeads, icon: Users, color: 'text-blue-600', bg: 'bg-blue-50' },
                  { label: 'Συνολικοί Πελάτες', value: stats.totalClients, icon: User, color: 'text-green-600', bg: 'bg-green-50' },
                  { label: 'Συνολικά Έσοδα', value: `€${stats.totalRevenue.toLocaleString()}`, icon: DollarSign, color: 'text-amber-600', bg: 'bg-amber-50' },
                  { label: 'Conversion Rate', value: `${stats.conversionRate}%`, icon: TrendingUp, color: 'text-purple-600', bg: 'bg-purple-50' },
                ].map((stat, i) => (
                  <div key={i} className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                    <div className="flex items-center justify-between mb-4">
                      <div className={`p-3 rounded-xl ${stat.bg} ${stat.color}`}>
                        <stat.icon size={24} />
                      </div>
                    </div>
                    <p className="text-gray-500 text-sm mb-1">{stat.label}</p>
                    <h3 className="text-2xl font-black">{stat.value}</h3>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-8">
                <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 h-[400px]">
                  <h3 className="font-bold mb-6">Κατανομή Status</h3>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={stats.statusData}
                        innerRadius={80}
                        outerRadius={120}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {stats.statusData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 h-[400px]">
                  <h3 className="font-bold mb-6">Έσοδα ανά Μήνα</h3>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={stats.revenueData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="value" fill="#ff8d01" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <table className="w-full text-left">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Όνομα</th>
                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Τηλέφωνο</th>
                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Γλώσσα</th>
                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Ημερομηνία</th>
                    <th className="px-6 py-4"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredLeads.map((lead) => (
                    <tr 
                      key={lead.id} 
                      className="hover:bg-gray-50 transition-colors cursor-pointer group"
                      onClick={() => {
                        setSelectedLead(lead);
                        setIsEditing(false);
                        setIsModalOpen(true);
                      }}
                    >
                      <td className="px-6 py-4">
                        <div className="font-bold">{lead.name}</div>
                        <div className="text-xs text-gray-400">{lead.audience === 'adult' ? 'Ενήλικας' : 'Παιδί'}</div>
                      </td>
                      <td className="px-6 py-4 text-sm">{lead.phone}</td>
                      <td className="px-6 py-4">
                        <span className="px-2 py-1 bg-gray-100 rounded text-xs font-medium">{lead.language}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-3 py-1 rounded-full text-xs font-bold ${getStatusColor(lead.status)}`}>
                          {getStatusLabel(lead.status)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-400">
                        {format(new Date(lead.created_at), 'dd/MM/yyyy')}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <ChevronRight className="inline-block text-gray-300 group-hover:text-[#ff8d01] transition-colors" size={20} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {/* Lead Detail/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-end">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setIsModalOpen(false)} />
          <div className="relative w-full max-w-xl bg-white h-screen shadow-2xl flex flex-col animate-slide-left">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-xl font-black">
                {isEditing ? (selectedLead ? 'Επεξεργασία Lead' : 'Νέο Lead') : 'Πληροφορίες Lead'}
              </h3>
              <div className="flex items-center gap-2">
                {!isEditing && activeTab !== 'trash' && (
                  <button 
                    onClick={() => setIsEditing(true)}
                    className="p-2 text-gray-400 hover:text-[#ff8d01] font-bold text-sm"
                  >
                    Edit
                  </button>
                )}
                <button onClick={() => setIsModalOpen(false)} className="p-2 text-gray-400 hover:text-black">
                  <X size={24} />
                </button>
              </div>
            </div>

            <form className="flex-1 overflow-auto p-8 space-y-6" onSubmit={handleSaveLead}>
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-400 uppercase">Ονοματεπώνυμο</label>
                  {isEditing ? (
                    <input name="name" required defaultValue={selectedLead?.name} className="w-full p-3 bg-gray-100 rounded-lg border-none focus:ring-2 focus:ring-[#ff8d01]" />
                  ) : (
                    <p className="text-lg font-bold">{selectedLead?.name}</p>
                  )}
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-400 uppercase">Τηλέφωνο</label>
                  {isEditing ? (
                    <input name="phone" required defaultValue={selectedLead?.phone} className="w-full p-3 bg-gray-100 rounded-lg border-none focus:ring-2 focus:ring-[#ff8d01]" />
                  ) : (
                    <p className="text-lg font-bold">{selectedLead?.phone}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-400 uppercase">Κοινό</label>
                  {isEditing ? (
                    <select name="audience" defaultValue={selectedLead?.audience} className="w-full p-3 bg-gray-100 rounded-lg border-none focus:ring-2 focus:ring-[#ff8d01]">
                      <option value="adult">Ενήλικας</option>
                      <option value="child">Παιδί</option>
                    </select>
                  ) : (
                    <p className="font-bold">{selectedLead?.audience === 'adult' ? 'Ενήλικας' : 'Παιδί'}</p>
                  )}
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-400 uppercase">Γλώσσα</label>
                  {isEditing ? (
                    <input name="language" defaultValue={selectedLead?.language} className="w-full p-3 bg-gray-100 rounded-lg border-none focus:ring-2 focus:ring-[#ff8d01]" />
                  ) : (
                    <p className="font-bold">{selectedLead?.language}</p>
                  )}
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-400 uppercase">Status</label>
                {isEditing ? (
                  <select name="status" defaultValue={selectedLead?.status || 'new'} className="w-full p-3 bg-gray-100 rounded-lg border-none focus:ring-2 focus:ring-[#ff8d01]">
                    <option value="new">Νέα Επαφή</option>
                    <option value="no-answer">Δεν απάντησε</option>
                    <option value="bad-moment">Κακή στιγμή</option>
                    <option value="appointment">Ραντεβού</option>
                    <option value="client">Πελάτης</option>
                    <option value="rejected">Απόρριψη</option>
                  </select>
                ) : (
                  <div>
                    <span className={`px-4 py-2 rounded-full text-sm font-bold ${getStatusColor(selectedLead?.status || 'new')}`}>
                      {getStatusLabel(selectedLead?.status || 'new')}
                    </span>
                  </div>
                )}
              </div>

              {/* Client Specific Fields */}
              {(isEditing || selectedLead?.status === 'client') && (
                <div className="p-6 bg-green-50 rounded-2xl border border-green-100 space-y-6">
                  <h4 className="font-bold text-green-800 flex items-center gap-2">
                    <CreditCard size={18} />
                    Στοιχεία Πελάτη
                  </h4>
                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-green-600 uppercase">Μηνιαία Συνδρομή (€)</label>
                      {isEditing ? (
                        <input name="monthly_subscription" type="number" defaultValue={selectedLead?.monthly_subscription} className="w-full p-3 bg-white rounded-lg border-none focus:ring-2 focus:ring-green-500" />
                      ) : (
                        <p className="text-lg font-bold">€{selectedLead?.monthly_subscription || 0}</p>
                      )}
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-green-600 uppercase">Ημερομηνία Εκκίνησης</label>
                      {isEditing ? (
                        <input name="start_date" type="date" defaultValue={selectedLead?.start_date} className="w-full p-3 bg-white rounded-lg border-none focus:ring-2 focus:ring-green-500" />
                      ) : (
                        <p className="text-lg font-bold">{selectedLead?.start_date ? format(new Date(selectedLead.start_date), 'dd/MM/yyyy') : '-'}</p>
                      )}
                    </div>
                  </div>
                  {!isEditing && selectedLead && (
                    <div className="pt-4 border-t border-green-200">
                      <label className="text-xs font-bold text-green-600 uppercase">Συνολικό Ποσό (Life-Time Value)</label>
                      <p className="text-2xl font-black text-green-700">€{calculateTotalRevenue(selectedLead).toLocaleString()}</p>
                    </div>
                  )}
                </div>
              )}

              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-400 uppercase">Σημειώσεις</label>
                {isEditing ? (
                  <textarea name="notes" rows={4} defaultValue={selectedLead?.notes} className="w-full p-3 bg-gray-100 rounded-lg border-none focus:ring-2 focus:ring-[#ff8d01]" />
                ) : (
                  <div className="p-4 bg-gray-50 rounded-lg text-sm whitespace-pre-wrap">{selectedLead?.notes || 'Καμία σημείωση'}</div>
                )}
              </div>

              {isEditing ? (
                <div className="pt-8">
                  <button type="submit" className="w-full py-4 bg-[#ff8d01] text-white rounded-xl font-bold shadow-lg flex items-center justify-center gap-2 transition-transform active:scale-95">
                    <Save size={20} />
                    Αποθήκευση
                  </button>
                </div>
              ) : (
                activeTab !== 'trash' && (
                  <div className="pt-8">
                    <button 
                      type="button" 
                      onClick={() => selectedLead && handleDelete(selectedLead.id)}
                      className="w-full py-4 text-red-600 font-bold hover:bg-red-50 rounded-xl transition-colors flex items-center justify-center gap-2"
                    >
                      <Trash2 size={20} />
                      Διαγραφή Lead
                    </button>
                  </div>
                )
              )}
            </form>
          </div>
        </div>
      )}

      <style>{`
        @keyframes slide-left {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
        .animate-slide-left {
          animation: slide-left 0.3s ease-out;
        }
      `}</style>
    </div>
  );
}
