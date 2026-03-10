import { useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabaseClient'
import { useAuth } from '../../../contexts/AuthContext'
import { format } from 'date-fns'

export default function UsersSection() {
  const [profiles, setProfiles] = useState([])
  const [technicians, setTechnicians] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(null)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('technician')
  const [inviting, setInviting] = useState(false)
  const [inviteMsg, setInviteMsg] = useState('')
  const { user } = useAuth()

  useEffect(() => { load() }, [])

  async function load() {
    const [profileRes, techRes] = await Promise.all([
      supabase.from('user_profiles').select('*, technicians(id, first_name, last_initial)'),
      supabase.from('technicians').select('id, first_name, last_initial').order('first_name'),
    ])
    setProfiles(profileRes.data || [])
    setTechnicians(techRes.data || [])
    setLoading(false)
  }

  async function updateRole(profileId, newRole) {
    setSaving(profileId)
    await supabase.from('user_profiles').update({
      role: newRole,
      approved_at: newRole !== 'pending' ? new Date().toISOString() : null,
    }).eq('id', profileId)
    await load()
    setSaving(null)
  }

  async function approveUser(profileId) {
    await updateRole(profileId, 'technician')
  }

  async function denyUser(profileId) {
    if (!confirm('Remove this user from the system? They will need to request access again.')) return
    setSaving(profileId)
    await supabase.from('user_profiles').delete().eq('id', profileId)
    await load()
    setSaving(null)
  }

  async function linkTechnician(profileId, technicianId) {
    setSaving(profileId)
    await supabase.from('user_profiles').update({
      technician_id: technicianId || null,
    }).eq('id', profileId)
    await load()
    setSaving(null)
  }

  async function sendInvite() {
    if (!inviteEmail.trim()) return
    setInviting(true); setInviteMsg('')
    const { error } = await supabase.auth.admin?.inviteUserByEmail
      ? supabase.auth.admin.inviteUserByEmail(inviteEmail, {
          data: { role: inviteRole },
          redirectTo: `${window.location.origin}/`,
        })
      : { error: { message: 'Admin invite requires a server-side function. Use the Supabase dashboard to invite users.' } }

    if (error) {
      setInviteMsg(`⚠️ ${error.message}`)
    } else {
      setInviteMsg(`✅ Invite sent to ${inviteEmail}`)
      setInviteEmail('')
    }
    setInviting(false)
  }

  const roleColors = {
    manager:    'bg-brand-green/15 text-brand-green border-brand-green/25',
    technician: 'bg-brand-blue/15 text-brand-blue border-brand-blue/25',
    pending:    'bg-brand-orange/15 text-brand-orange border-brand-orange/25',
  }

  const pendingProfiles  = profiles.filter(p => p.role === 'pending')
  const approvedProfiles = profiles.filter(p => p.role !== 'pending')

  return (
    <div className="p-6 max-w-3xl">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-white font-bold text-xl">User Management</h2>
        <span className="text-white/30 text-sm">{profiles.length} user{profiles.length !== 1 ? 's' : ''}</span>
      </div>
      <p className="text-white/30 text-xs mb-6">
        Approve new users and assign roles. Only approved users can access the application.
      </p>

      {/* ── Pending Approvals ─────────────────────────────────────────── */}
      {pendingProfiles.length > 0 && (
        <>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-brand-orange text-xs font-semibold tracking-widest uppercase">⏳ Awaiting Approval</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-brand-orange/15 text-brand-orange border border-brand-orange/25">{pendingProfiles.length}</span>
          </div>
          <div className="rounded-xl overflow-hidden border border-brand-orange/20 mb-6 bg-brand-orange/5">
            {pendingProfiles.map((p, i) => (
              <div key={p.id} className={`flex flex-col sm:flex-row sm:items-center gap-3 px-4 py-4 ${i < pendingProfiles.length - 1 ? 'border-b border-brand-orange/15' : ''}`}>
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="w-8 h-8 rounded-full bg-brand-orange/15 border border-brand-orange/20 flex items-center justify-center text-sm font-semibold text-brand-orange flex-shrink-0">
                    {(p.display_name || '?')[0].toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="text-white text-sm font-medium truncate">{p.display_name || <span className="text-white/30 italic">No name</span>}</p>
                    <p className="text-white/30 text-xs">Requested access · waiting for manager approval</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {saving === p.id ? (
                    <span className="text-white/30 text-xs animate-pulse">Saving…</span>
                  ) : (
                    <>
                      <button
                        onClick={() => approveUser(p.id)}
                        className="px-3 py-1.5 rounded-lg bg-brand-green text-forest-950 text-xs font-semibold hover:bg-brand-green/90 transition-all"
                      >
                        ✓ Approve
                      </button>
                      <button
                        onClick={() => denyUser(p.id)}
                        className="px-3 py-1.5 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20 text-xs font-semibold hover:bg-red-500/20 transition-all"
                      >
                        ✕ Deny
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Role legend */}
      <div className="flex gap-3 mb-4">
        <span className="text-xs px-2.5 py-1 rounded-full border bg-brand-green/15 text-brand-green border-brand-green/25">Manager — full access</span>
        <span className="text-xs px-2.5 py-1 rounded-full border bg-brand-blue/15 text-brand-blue border-brand-blue/25">Technician — log &amp; view only</span>
      </div>

      {/* ── Approved Users ─────────────────────────────────────────────── */}
      <h3 className="text-white/60 text-xs font-semibold tracking-widest uppercase mb-3">Approved Users</h3>
      <div className="glass rounded-xl overflow-hidden mb-8">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-16 border-b border-white/5 animate-pulse" />
          ))
        ) : approvedProfiles.length === 0 ? (
          <p className="text-white/30 text-sm text-center py-8">No approved users yet.</p>
        ) : approvedProfiles.map((p, i) => {
          const isMe = p.user_id === user?.id
          const isSaving = saving === p.id
          return (
            <div
              key={p.id}
              className={`flex flex-col sm:flex-row sm:items-center gap-3 px-4 py-4 ${i < approvedProfiles.length - 1 ? 'border-b border-white/5' : ''}`}
            >
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-sm font-semibold text-white/60 flex-shrink-0">
                  {(p.display_name || p.user_id)?.[0]?.toUpperCase() ?? '?'}
                </div>
                <div className="min-w-0">
                  <p className="text-white text-sm font-medium truncate">
                    {p.display_name || <span className="text-white/30 italic">No name set</span>}
                    {isMe && <span className="ml-1.5 text-brand-green text-xs">(you)</span>}
                  </p>
                  {p.technicians && (
                    <p className="text-white/30 text-xs">
                      Linked: {p.technicians.first_name} {p.technicians.last_initial}.
                    </p>
                  )}
                </div>
              </div>

              <select
                value={p.role}
                disabled={isSaving || isMe}
                onChange={e => updateRole(p.id, e.target.value)}
                className="bg-forest-800 border border-white/10 rounded-lg px-2.5 py-1.5 text-white text-xs outline-none disabled:opacity-40 cursor-pointer"
              >
                <option value="technician">Technician</option>
                <option value="manager">Manager</option>
              </select>

              <select
                value={p.technician_id || ''}
                disabled={isSaving}
                onChange={e => linkTechnician(p.id, e.target.value)}
                className="bg-forest-800 border border-white/10 rounded-lg px-2.5 py-1.5 text-white text-xs outline-none disabled:opacity-40 cursor-pointer"
              >
                <option value="">No tech link</option>
                {technicians.map(t => (
                  <option key={t.id} value={t.id}>
                    {t.first_name} {t.last_initial ? `${t.last_initial}.` : ''}
                  </option>
                ))}
              </select>

              {isSaving && <span className="text-white/30 text-xs animate-pulse">Saving…</span>}
              <span className={`text-xs px-2 py-0.5 rounded-full border flex-shrink-0 ${roleColors[p.role] || 'bg-white/10 text-white/50'}`}>
                {p.role}
              </span>
            </div>
          )
        })}
      </div>

      <h3 className="text-white/60 text-xs font-semibold tracking-widest uppercase mb-3">Invite New User</h3>
      <div className="glass rounded-xl p-4">
        <p className="text-white/30 text-xs mb-4">
          Send an invite email. The user will set up their own password and be added to the system.
          <br />
          <span className="text-brand-orange">Note:</span> OAuth invites require configuring Google/Facebook/Apple in the{' '}
          <a
            href="https://supabase.com/dashboard/project/jxydfmareguchcqelaiw/auth/providers"
            target="_blank"
            rel="noopener noreferrer"
            className="text-brand-blue hover:underline"
          >
            Supabase Auth Providers dashboard
          </a>.
        </p>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="email"
            placeholder="user@example.com"
            value={inviteEmail}
            onChange={e => setInviteEmail(e.target.value)}
            className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm outline-none placeholder-white/25 focus:border-brand-green/50"
          />
          <select
            value={inviteRole}
            onChange={e => setInviteRole(e.target.value)}
            className="bg-forest-800 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm outline-none"
          >
            <option value="technician">Technician</option>
            <option value="manager">Manager</option>
          </select>
          <button
            onClick={sendInvite}
            disabled={inviting || !inviteEmail.trim()}
            className="px-4 py-2.5 rounded-xl bg-brand-green text-forest-950 font-semibold text-sm disabled:opacity-40 hover:bg-brand-green/90 transition-all"
          >
            {inviting ? 'Sending…' : 'Send Invite'}
          </button>
        </div>
        {inviteMsg && (
          <p className={`text-xs mt-3 ${inviteMsg.startsWith('✅') ? 'text-brand-green' : 'text-brand-orange'}`}>
            {inviteMsg}
          </p>
        )}
        <p className="text-white/20 text-xs mt-4">
          Or invite directly from the{' '}
          <a
            href="https://supabase.com/dashboard/project/jxydfmareguchcqelaiw/auth/users"
            target="_blank"
            rel="noopener noreferrer"
            className="text-brand-blue hover:underline"
          >
            Supabase Users dashboard
          </a>
        </p>
      </div>
    </div>
  )
}
