import { useState, useEffect } from 'react'
import { supabase } from '../../../lib/supabaseClient'

export default function SettingsSection() {
  const [threshold, setThreshold] = useState('')
  const [twilioSid, setTwilioSid] = useState('')
  const [twilioToken, setTwilioToken] = useState('')
  const [twilioPhone, setTwilioPhone] = useState('')
  const [autoSmsEnabled, setAutoSmsEnabled] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    loadSettings()
  }, [])

  async function loadSettings() {
    setLoading(true)
    const { data } = await supabase.from('settings').select('*')
    if (data) {
      const dbThreshold = data.find(s => s.key === 'low_stock_threshold')?.value
      if (dbThreshold) setThreshold(dbThreshold)

      const dbTwilioSid = data.find(s => s.key === 'twilio_sid')?.value
      if (dbTwilioSid) setTwilioSid(dbTwilioSid)

      const dbTwilioToken = data.find(s => s.key === 'twilio_auth_token')?.value
      if (dbTwilioToken) setTwilioToken(dbTwilioToken)

      const dbTwilioPhone = data.find(s => s.key === 'twilio_phone_number')?.value
      if (dbTwilioPhone) setTwilioPhone(dbTwilioPhone)

      const dbSmsEnabled = data.find(s => s.key === 'auto_review_sms_enabled')?.value
      if (dbSmsEnabled) setAutoSmsEnabled(dbSmsEnabled === 'true')
    }
    setLoading(false)
  }

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    setMessage('')

    const updates = [
      { key: 'low_stock_threshold', value: threshold.toString() },
      { key: 'twilio_sid', value: twilioSid },
      { key: 'twilio_auth_token', value: twilioToken },
      { key: 'twilio_phone_number', value: twilioPhone },
      { key: 'auto_review_sms_enabled', value: autoSmsEnabled.toString() }
    ]

    const { error } = await supabase.from('settings').upsert(updates, { onConflict: 'key' })

    if (error) {
      setMessage('Error saving settings.')
      console.error(error)
    } else {
      setMessage('Settings saved successfully.')
      setTimeout(() => setMessage(''), 3000)
    }
    setSaving(false)
  }

  // Fallback dev tool: Create a Manager manually if needed
  async function forceCreateManager() {
    const email = prompt("Enter email to promote to Manager:")
    if (!email) return
    
    // Attempt to update user_profiles role directly.
    // Note: If RLS prevents this, it means the current user is NOT a manager.
    // In an empty db, you must use the Supabase SQL Editor to promote the first manager.
    const { data: profile } = await supabase.from('user_profiles').select('id').eq('email', email).single()
    if (!profile) return alert("User not found in profiles (they must sign up first)")

    const { error } = await supabase
      .from('user_profiles')
      .update({ role: 'manager' })
      .eq('id', profile.id)

    if (error) {
      alert("Failed to promote. You may not have RLS permission. Do this via Supabase Dashboard SQL Editor.")
    } else {
      alert(`${email} is now a manager.`)
    }
  }

  if (loading) {
    return <div className="p-4 text-white/50 text-sm">Loading settings...</div>
  }

  return (
    <div className="p-4 max-w-2xl">
      <h2 className="text-xl font-bold text-white mb-6">System Settings</h2>

      <form onSubmit={handleSave} className="space-y-8">
        {/* Core Settings */}
        <section className="glass p-6 rounded-2xl border border-white/5 space-y-4">
          <h3 className="text-white font-bold text-lg mb-2 flex items-center gap-2">
            <span>⚙️</span> Core Settings
          </h3>
          <div>
            <label className="block text-white/70 text-sm font-medium mb-2">
              Low Stock Global Threshold
            </label>
            <p className="text-white/40 text-xs mb-3">
              If any product falls below this number of containers, a warning banner will appear.
            </p>
            <input
              type="number"
              required
              min="0"
              className="w-full bg-forest-950 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-brand-green"
              value={threshold}
              onChange={e => setThreshold(e.target.value)}
            />
          </div>
        </section>

        {/* Automations */}
        <section className="glass p-6 rounded-2xl border border-white/5 space-y-4">
          <div className="flex justify-between items-start">
            <h3 className="text-white font-bold text-lg mb-2 flex items-center gap-2">
              <span>🤖</span> Automations
            </h3>
            <label className="flex items-center cursor-pointer">
              <div className="relative">
                <input 
                  type="checkbox" 
                  className="sr-only" 
                  checked={autoSmsEnabled}
                  onChange={(e) => setAutoSmsEnabled(e.target.checked)}
                />
                <div className={`block w-14 h-8 rounded-full transition-colors ${autoSmsEnabled ? 'bg-brand-green' : 'bg-white/10'}`}></div>
                <div className={`dot absolute left-1 top-1 bg-white w-6 h-6 rounded-full transition-transform ${autoSmsEnabled ? 'transform translate-x-6' : ''}`}></div>
              </div>
            </label>
          </div>
          <p className="text-white/40 text-xs mb-4">
            Configure Twilio API keys to send automated Review Request SMS messages to customers when Jobs are marked complete.
          </p>

          <div className={`space-y-4 transition-opacity ${!autoSmsEnabled ? 'opacity-40 pointer-events-none' : ''}`}>
             <div>
              <label className="block text-white/70 text-sm font-medium mb-1">Twilio Account SID</label>
              <input
                type="text"
                className="w-full bg-forest-950 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500 font-mono text-sm"
                value={twilioSid}
                onChange={e => setTwilioSid(e.target.value)}
                placeholder="ACXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
              />
            </div>
            <div>
              <label className="block text-white/70 text-sm font-medium mb-1">Twilio Auth Token</label>
              <input
                type="password"
                className="w-full bg-forest-950 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500 font-mono text-sm"
                value={twilioToken}
                onChange={e => setTwilioToken(e.target.value)}
                placeholder="••••••••••••••••••••••••••••••••"
              />
            </div>
            <div>
              <label className="block text-white/70 text-sm font-medium mb-1">Twilio Phone Number</label>
              <input
                type="text"
                className="w-full bg-forest-950 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500 font-mono text-sm"
                value={twilioPhone}
                onChange={e => setTwilioPhone(e.target.value)}
                placeholder="+12345678900"
              />
            </div>
          </div>
        </section>

        {message && (
          <div className="p-3 rounded-lg bg-brand-green/20 text-brand-green text-sm font-medium text-center border border-brand-green/30">
            {message}
          </div>
        )}

        <button
          type="submit"
          disabled={saving}
          className="w-full py-4 bg-brand-green text-forest-950 font-bold rounded-xl text-lg hover:bg-brand-green/90 transition-colors disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save All Settings'}
        </button>
      </form>

      {/* Danger Zone */}
      <div className="mt-12 pt-8 border-t border-red-500/20">
        <h3 className="text-red-400 font-bold mb-4 flex items-center gap-2">
          <span>⚠️</span> Danger Zone
        </h3>
        <button
          onClick={forceCreateManager}
          className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-sm font-medium rounded-lg border border-red-500/20 transition-colors"
        >
          Force Promote User to Manager
        </button>
        <p className="text-white/30 text-xs mt-2">
          Use only if RLS policies are misconfigured and you need to bootstrap a manager account. 
          Will only work if you are already a manager.
        </p>
      </div>
    </div>
  )
}
