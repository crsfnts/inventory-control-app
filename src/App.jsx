import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, ArrowRightLeft, BarChart3, Boxes, ClipboardCheck, Database, FileClock, Layers, LoaderCircle, Lock, LogOut, PackagePlus, RefreshCcw, ShieldCheck, UserCog, Users } from 'lucide-react'
import { supabase } from './supabaseClient'

const ADMIN_EMAILS = ['cfuentes@nohn-pa.org', 'crsfnts@gmail.com']
const getRoute = () => window.location.hash.replace('#/', '') || 'dashboard'
const keyFor = (itemId, locationId) => `${itemId}|${locationId}`
const monthStart = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01` }
const safeError = (e) => e?.message || 'Unexpected error'
const itemLabel = (i) => i.manufacturer ? `${i.name} — ${i.manufacturer}` : i.name

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
  { id: 'inventory', label: 'Inventory', icon: Layers },
  { id: 'admin', label: 'Admin', icon: ShieldCheck, adminOnly: true },
  { id: 'reports', label: 'Reports', icon: FileClock }
]

const SelectField = ({ label, value, onChange, children }) => <label className='field'><span>{label}</span><select value={value} onChange={e => onChange(e.target.value)} required>{children}</select></label>
const NumberField = ({ label, value, onChange }) => <label className='field'><span>{label}</span><input type='number' value={value} onChange={e => onChange(e.target.value)} required /></label>
const TextField = ({ label, value, onChange }) => <label className='field'><span>{label}</span><input value={value} onChange={e => onChange(e.target.value)} /></label>

const Card = ({ children, className = '' }) => <section className={`panel ${className}`.trim()}>{children}</section>
const PageHeader = ({ title, subtitle }) => <div><h1>{title}</h1>{subtitle && <p className='subtitle'>{subtitle}</p>}</div>

function AuthScreen({ message }) {
  const [mode, setMode] = useState('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [authError, setAuthError] = useState('')
  const [busy, setBusy] = useState(false)

  function mapAuthError(error) {
    const m = (error?.message || '').toLowerCase()
    if (m.includes('invalid login credentials')) return 'Invalid email or password.'
    if (m.includes('email not confirmed')) return 'Please check your email to confirm your account.'
    if (m.includes('session')) return 'Session expired. Please sign in again.'
    return 'Unable to sign in. Please try again.'
  }

  async function submit(e) {
    e.preventDefault(); setAuthError(''); setBusy(true)
    const op = mode === 'signin' ? supabase.auth.signInWithPassword({ email, password }) : supabase.auth.signUp({ email, password })
    const { error } = await op
    if (error) setAuthError(mapAuthError(error))
    if (!error && mode === 'signup') setAuthError('Account created. Check your email to confirm before signing in.')
    setBusy(false)
  }

  return <div className='authShell'><div className='authBackdrop' /><div className='authCard'>
    <div className='logo authLogo'><Boxes size={20} />Inventory Control</div>
    <h1>Sign in to continue to Inventory Control</h1>
    <p className='subtitle'>Secure inventory workflows for NOHN operations</p>
    {message && <div className='toast'>{message}</div>}
    <form onSubmit={submit} className='formStack'>
      <TextField label='Email' value={email} onChange={setEmail} />
      <label className='field'><span>Password</span><input type='password' value={password} onChange={e => setPassword(e.target.value)} required /></label>
      {authError && <div className='warning'>{authError}</div>}
      <button className='primaryButton' disabled={busy}>{busy ? <><LoaderCircle className='spin' size={16} />Please wait...</> : mode === 'signin' ? 'Sign in' : 'Create account'}</button>
    </form>
    <button className='ghostButton' onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')}>{mode === 'signin' ? 'Need an account? Sign up' : 'Have an account? Sign in'}</button>
  </div></div>
}

function Topbar({ title, subtitle, onRefresh, refreshing, email, onSignOut }) {
  const initials = (email || 'U').slice(0, 2).toUpperCase()
  return <header className='topbar'><PageHeader title={title} subtitle={subtitle} /><div className='topbarActions'><button className='ghostButton' onClick={onRefresh} disabled={refreshing} title='Refresh current page data' aria-label='Refresh current page data'>{refreshing ? <LoaderCircle className='spin' size={14} /> : <RefreshCcw size={14} />}Refresh</button><div className='userBadge' title={email}><span>{initials}</span><small>{email}</small></div><button className='ghostButton' onClick={onSignOut}><LogOut size={14} />Sign out</button></div></header>
}

export default function App() {
  const [session, setSession] = useState(null), [loading, setLoading] = useState(true), [active, setActive] = useState(getRoute())
  const [profile, setProfile] = useState(null), [items, setItems] = useState([]), [locations, setLocations] = useState([]), [pars, setPars] = useState([]), [transactions, setTransactions] = useState([]), [counts, setCounts] = useState([]), [profiles, setProfiles] = useState([]), [toast, setToast] = useState(''), [authNotice, setAuthNotice] = useState(''), [refreshing, setRefreshing] = useState(false)
  const isAdmin = profile?.role === 'admin' && profile?.active !== false

  useEffect(() => { const sync = () => setActive(getRoute()); window.addEventListener('hashchange', sync); return () => window.removeEventListener('hashchange', sync) }, [])
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setLoading(false) })
    const { data: sub } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (event === 'SIGNED_OUT') {
        setProfile(null); setItems([]); setLocations([]); setPars([]); setTransactions([]); setCounts([]); setProfiles([])
        setAuthNotice('You have been signed out successfully.')
        window.location.hash = '/login'
      }
      if (event === 'TOKEN_REFRESHED' && !nextSession) setAuthNotice('Session expired. Please sign in again.')
      setSession(nextSession)
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  useEffect(() => { if (session) loadAll() }, [session])

  async function refreshProfile() {
    const { data } = await supabase.from('profiles').select('*').eq('id', session.user.id).maybeSingle()
    if (data) return data
    const email = (session.user.email || '').toLowerCase(); const role = ADMIN_EMAILS.includes(email) ? 'admin' : 'staff'
    await supabase.from('profiles').upsert({ id: session.user.id, email: session.user.email, role, active: true }, { onConflict: 'id' })
    return (await supabase.from('profiles').select('*').eq('id', session.user.id).single()).data
  }

  async function loadAll() {
    if (!session) return
    setRefreshing(true)
    try {
      setProfile(await refreshProfile())
      const [i, l, p, t, c, pr] = await Promise.all([supabase.from('items').select('*').order('name'), supabase.from('locations').select('*').order('name'), supabase.from('par_levels').select('*'), supabase.from('transactions').select('*').order('created_at', { ascending: false }), supabase.from('monthly_counts').select('*').order('created_at', { ascending: false }), supabase.from('profiles').select('*').order('created_at')])
      setItems(i.data || []); setLocations(l.data || []); setPars(p.data || []); setTransactions(t.data || []); setCounts(c.data || []); setProfiles(pr.data || [])
    } catch (e) {
      setToast(`Refresh failed: ${safeError(e)}`)
    } finally {
      setRefreshing(false); setLoading(false)
    }
  }

  const balances = useMemo(() => transactions.reduce((a, tx) => { const k = keyFor(tx.item_id, tx.location_id); a[k] = (a[k] || 0) + Number(tx.quantity || 0); return a }, {}), [transactions])
  const balanceFor = (i, l) => balances[keyFor(i, l)] || 0
  const usage = useMemo(() => ({ item: new Set([...transactions.map(t => t.item_id), ...counts.map(c => c.item_id), ...pars.map(p => p.item_id)]), location: new Set([...transactions.map(t => t.location_id), ...counts.map(c => c.location_id), ...pars.map(p => p.location_id)]) }), [transactions, counts, pars])
  async function insertTransaction(tx) { const { error } = await supabase.from('transactions').insert({ ...tx, user_id: session.user.id }); if (error) return setToast(safeError(error)); await loadAll() }
  async function deleteItem(id) { const { error } = await supabase.rpc('delete_item_if_unused', { item_id: id }); if (error) setToast(safeError(error)); else loadAll() }
  async function deleteLocation(id) { const { error } = await supabase.rpc('delete_location_if_unused', { location_id: id }); if (error) setToast(safeError(error)); else loadAll() }

  async function signOut() {
    await supabase.auth.signOut()
    setSession(null); setProfile(null); setActive('dashboard')
    window.location.hash = '/login'
  }

  if (loading && !session) return <div className='loading'>Loading...</div>
  if (!session) return <AuthScreen message={authNotice} />

  const nav = NAV_ITEMS.filter((n) => isAdmin || !n.adminOnly)
  const pageMeta = { dashboard: { title: 'Dashboard', subtitle: 'Operational summary and below-par status' }, inventory: { title: 'Inventory', subtitle: 'Add, remove, transfer, and monthly count actions' }, admin: { title: 'Admin', subtitle: 'Users, item/location setup, and par levels' }, reports: { title: 'Reports', subtitle: 'History and export records' } }
  const meta = pageMeta[active] || pageMeta.dashboard
  return <div className='appShell'>
    <aside className='sidebar'>
      <div className='logo'><Boxes />Inventory Control</div>
      <small className='rolePill'>{isAdmin ? 'Admin view' : 'Staff view'}</small>
      <nav>{nav.map(({ id, label, icon: Icon }) => <button key={id} className={active === id ? 'active' : ''} onClick={() => window.location.hash = `/${id}`}><Icon size={15} />{label}</button>)}</nav>
    </aside>
    <main className='main'>
      <Topbar title={meta.title} subtitle={meta.subtitle} onRefresh={loadAll} refreshing={refreshing} email={session.user.email} onSignOut={signOut} />
      {toast && <div className='toast'>{toast}</div>}
      {active === 'dashboard' && <Dashboard items={items} locations={locations} pars={pars} transactions={transactions} counts={counts} balances={balances} />}
      {active === 'inventory' && <InventoryActions items={items.filter(i => i.active !== false)} locations={locations.filter(l => l.active !== false)} insertTransaction={insertTransaction} balanceFor={balanceFor} session={session} loadAll={loadAll} setToast={setToast} />}
      {active === 'admin' && (isAdmin ? <Setup {...{ profiles, items, locations, pars, counts, transactions, usage, setToast, loadAll, insertTransaction, balanceFor, deleteItem, deleteLocation }} /> : <Card><Lock />Admin required.</Card>)}
      {active === 'reports' && <HistoryView transactions={transactions} items={items} locations={locations} />}
    </main>
  </div>
}

function Dashboard({ items, locations, pars, transactions, balances }) { const activeItems = items.filter(i => i.active !== false); const activeLocations = locations.filter(l => l.active !== false); const parMap = new Map(pars.map(p => [`${p.item_id}|${p.location_id}`, p])); const rows = [...parMap.entries()].map(([k, p]) => ({ k, ...p, current: balances[k] || 0, item: items.find(i => i.id === p.item_id), loc: locations.find(l => l.id === p.location_id) })); const below = rows.filter(r => r.current < Number(r.par_level || 0)); const near = rows.filter(r => r.current >= Number(r.par_level || 0) && r.current < Number(r.target_level || r.par_level || 0)); return <div className='gridStack'><section className='kpiGrid'>{[['Total Active Items', activeItems.length], ['Total Locations', activeLocations.length], ['Items Below Par', below.length], ['Items Near Par', near.length], ['Total Units', Object.values(balances).reduce((a, b) => a + b, 0)], ['Recent Corrections', transactions.filter(t => t.action === 'ADMIN_ADJUSTMENT').length], ['Monthly Adjustments', transactions.filter(t => t.action === 'MONTHLY_ADJUSTMENT').length]].map(([l, v]) => <div key={l} className='kpi'><h4>{l}</h4><strong>{v}</strong></div>)}</section><Card><h2>Below Par Watchlist</h2><div className='tableWrap'><table><thead><tr><th>Item</th><th>Manufacturer</th><th>Location</th><th>Current</th><th>Par</th><th>Target</th></tr></thead><tbody>{below.slice(0, 10).map(r => <tr key={r.k}><td>{r.item?.name}</td><td>{r.item?.manufacturer || '—'}</td><td>{r.loc?.name}</td><td>{r.current}</td><td>{r.par_level}</td><td>{r.target_level}</td></tr>)}</tbody></table></div>{!below.length && <p>No items below par.</p>}</Card></div> }
function InventoryActions(props) { const actions = [['Add Stock', PackagePlus], ['Remove Stock', ClipboardCheck], ['Transfer', ArrowRightLeft], ['Monthly Count', Database]]; return <div className='gridStack'><Card><h2>Inventory Actions</h2><div className='actionGrid'>{actions.map(([title, Icon]) => <div key={title} className='actionCard'><Icon size={20} /><strong>{title}</strong></div>)}</div></Card><TransactionFormBase mode='ADD' {...props} /><TransactionFormBase mode='REMOVE' {...props} /><TransferStock {...props} /><MonthlyCount {...props} /></div> }
function Setup({ profiles, items, locations, pars, usage, setToast, loadAll, deleteItem, deleteLocation }) { const [itemName, setItemName] = useState(''), [manufacturer, setManufacturer] = useState(''), [category, setCategory] = useState('Medication'), [locationName, setLocationName] = useState(''); async function addItem(e) { e.preventDefault(); const { error } = await supabase.from('items').insert({ name: itemName, category, manufacturer }); if (error) setToast(error.message); else { setItemName(''); setManufacturer(''); loadAll() } } async function addLocation(e) { e.preventDefault(); const { error } = await supabase.from('locations').insert({ name: locationName }); if (error) setToast(error.message); else { setLocationName(''); loadAll() } } async function toggle(table, row) { await supabase.from(table).update({ active: !row.active }).eq('id', row.id); loadAll() } async function updateUser(id, patch) { await supabase.from('profiles').update(patch).eq('id', id); loadAll() } async function deletePar(id) { if (confirm('Delete par level record?')) { await supabase.from('par_levels').delete().eq('id', id); loadAll() } }
  return <div className='gridStack'><Card><h2>Admin Workspace</h2><div className='actionGrid'>{[['Users', Users], ['Items / Medications', PackagePlus], ['Locations', Database], ['Par Levels', BarChart3], ['Opening Inventory / Adjustments', UserCog]].map(([name, Icon]) => <div className='actionCard' key={name}><Icon size={19} /><strong>{name}</strong></div>)}</div></Card><Card><h2>User Management</h2>{profiles.map(p => <div key={p.id}>{p.email} <button onClick={() => updateUser(p.id, { active: !p.active })}>{p.active ? 'Deactivate User' : 'Reactivate User'}</button></div>)}</Card><section className='twoCol'><form className='panel formStack' onSubmit={addItem}><h2>Items</h2><TextField label='Name' value={itemName} onChange={setItemName} /><TextField label='Manufacturer' value={manufacturer} onChange={setManufacturer} /><TextField label='Category' value={category} onChange={setCategory} /><button className='primaryButton'><PackagePlus size={16} />Add Item</button>{items.map(i => <div key={i.id}>{itemLabel(i)} <button type='button' onClick={() => toggle('items', i)}>{i.active ? 'Archive' : 'Unarchive'}</button> <button type='button' onClick={() => usage.item.has(i.id) ? setToast('This item has inventory history and cannot be permanently deleted. Archive it instead to preserve the audit trail.') : confirm('Are you sure you want to permanently delete this item? This cannot be undone.') && deleteItem(i.id)}>Delete</button></div>)}</form><form className='panel formStack' onSubmit={addLocation}><h2>Locations</h2><TextField label='Name' value={locationName} onChange={setLocationName} /><button className='primaryButton'><Database size={16} />Add Location</button>{locations.map(l => <div key={l.id}>{l.name} <button type='button' onClick={() => toggle('locations', l)}>{l.active ? 'Archive' : 'Unarchive'}</button> <button type='button' onClick={() => usage.location.has(l.id) ? setToast('This location has inventory history and cannot be permanently deleted. Archive it instead to preserve the audit trail.') : confirm('Are you sure you want to permanently delete this location? This cannot be undone.') && deleteLocation(l.id)}>Delete</button></div>)}</form></section><Card><h2>Par Levels</h2>{pars.map(p => <div key={p.id}>{p.item_id} / {p.location_id} <button onClick={() => deletePar(p.id)}>Delete</button></div>)}</Card></div>
}
function TransactionFormBase({ mode, items, locations, insertTransaction, balanceFor }) { const [itemId, setItemId] = useState(''); const [locationId, setLocationId] = useState(''); const [quantity, setQuantity] = useState(''); const [saving, setSaving] = useState(false); const q = Number(quantity || 0); const current = itemId && locationId ? balanceFor(itemId, locationId) : 0; const signedQty = mode === 'REMOVE' ? -Math.abs(q) : Math.abs(q); const invalidRemove = mode === 'REMOVE' && q > current; async function save(e) { e.preventDefault(); if (invalidRemove) return; setSaving(true); await insertTransaction({ item_id: itemId, location_id: locationId, action: mode, quantity: signedQty, reason: mode === 'ADD' ? 'Received stock' : 'Inventory removal' }); setSaving(false) } return <section className='panel'><h3>{mode === 'ADD' ? 'Add Stock' : 'Remove Stock'}</h3><form onSubmit={save} className='formGrid'><SelectField label='Item' value={itemId} onChange={setItemId}><option value=''>Choose item...</option>{items.map((i) => <option key={i.id} value={i.id}>{itemLabel(i)}</option>)}</SelectField><SelectField label='Location' value={locationId} onChange={setLocationId}><option value=''>Choose location...</option>{locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</SelectField><NumberField label='Quantity' value={quantity} onChange={setQuantity} />{invalidRemove && <div className='warning full'><AlertTriangle size={18} /> Cannot remove more than current balance.</div>}<button className='primaryButton full' disabled={saving}>{saving ? <><LoaderCircle className='spin' size={15} />Saving...</> : 'Save'}</button></form></section> }
function TransferStock({ items, locations, session, loadAll, setToast, balanceFor }) { const [itemId, setItemId] = useState(''); const [fromId, setFromId] = useState(''); const [toId, setToId] = useState(''); const [quantity, setQuantity] = useState(''); const [saving, setSaving] = useState(false); const q = Number(quantity || 0); const current = itemId && fromId ? balanceFor(itemId, fromId) : 0; const invalid = !itemId || !fromId || !toId || fromId === toId || !q || q > current; async function save(e) { e.preventDefault(); if (invalid) return; setSaving(true); const { error } = await supabase.from('transactions').insert([{ user_id: session.user.id, item_id: itemId, location_id: fromId, action: 'TRANSFER_OUT', quantity: -Math.abs(q), reason: 'Transfer out' }, { user_id: session.user.id, item_id: itemId, location_id: toId, action: 'TRANSFER_IN', quantity: Math.abs(q), reason: 'Transfer in' }]); if (error) setToast(safeError(error)); else await loadAll(); setSaving(false) } return <section className='panel'><h3>Transfer</h3><form onSubmit={save} className='formGrid'><SelectField label='Item' value={itemId} onChange={setItemId}><option value=''>Choose item...</option>{items.map(i => <option key={i.id} value={i.id}>{itemLabel(i)}</option>)}</SelectField><SelectField label='From' value={fromId} onChange={setFromId}><option value=''>Choose source...</option>{locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}</SelectField><SelectField label='To' value={toId} onChange={setToId}><option value=''>Choose destination...</option>{locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}</SelectField><NumberField label='Quantity' value={quantity} onChange={setQuantity} /><button className='primaryButton full' disabled={saving}>{saving ? <><LoaderCircle className='spin' size={15} />Saving...</> : 'Save Transfer'}</button></form></section> }
function MonthlyCount({ items, locations, session, loadAll, setToast, balanceFor }) { const [itemId, setItemId] = useState(''); const [locationId, setLocationId] = useState(''); const [physical, setPhysical] = useState(''); const [countMonth, setCountMonth] = useState(monthStart()); const [saving, setSaving] = useState(false); const systemBalance = itemId && locationId ? balanceFor(itemId, locationId) : 0; const difference = Number(physical || 0) - Number(systemBalance); async function save(e) { e.preventDefault(); setSaving(true); const { data, error } = await supabase.from('monthly_counts').insert({ user_id: session.user.id, count_month: countMonth, item_id: itemId, location_id: locationId, system_balance: systemBalance, physical_count: Number(physical), difference }).select().single(); if (error) { setToast(safeError(error)); setSaving(false); return } if (difference !== 0) await supabase.from('transactions').insert({ user_id: session.user.id, item_id: itemId, location_id: locationId, action: 'MONTHLY_ADJUSTMENT', quantity: difference, reason: 'Monthly physical count adjustment', monthly_count_id: data.id }); await loadAll(); setSaving(false) } return <section className='panel'><h3>Monthly Count</h3><form onSubmit={save} className='formGrid'><label className='field'><span>Count Month</span><input type='date' value={countMonth} onChange={(e) => setCountMonth(e.target.value)} /></label><SelectField label='Item' value={itemId} onChange={setItemId}><option value=''>Choose item...</option>{items.map(i => <option key={i.id} value={i.id}>{itemLabel(i)}</option>)}</SelectField><SelectField label='Location' value={locationId} onChange={setLocationId}><option value=''>Choose location...</option>{locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}</SelectField><NumberField label='Physical' value={physical} onChange={setPhysical} /><button className='primaryButton full' disabled={saving}>{saving ? <><LoaderCircle className='spin' size={15} />Saving...</> : 'Save Count'}</button></form></section> }
function HistoryView({ transactions, items, locations }) { const item = (id) => items.find(x => x.id === id); const loc = (id) => locations.find(x => x.id === id); return <section className='panel'><h2>History / Export</h2><div className='actionGrid mini'><div className='actionCard'><FileClock size={16} /><strong>History</strong></div><div className='actionCard'><Database size={16} /><strong>Export</strong></div></div><div className='tableWrap'><table><thead><tr><th>Date</th><th>Action</th><th>Item</th><th>Location</th><th>Qty</th></tr></thead><tbody>{transactions.map((t) => <tr key={t.id}><td>{new Date(t.created_at).toLocaleString()}</td><td>{t.action}</td><td>{itemLabel(item(t.item_id) || { name: 'Unknown' })}</td><td>{loc(t.location_id)?.name || 'Unknown'}</td><td>{t.quantity}</td></tr>)}</tbody></table></div></section> }
