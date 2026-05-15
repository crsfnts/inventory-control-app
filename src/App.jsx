import { useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  ArrowLeftRight,
  BarChart3,
  Boxes,
  CheckCircle2,
  ClipboardCheck,
  Database,
  History,
  Lock,
  LogOut,
  MinusCircle,
  PackagePlus,
  PlusCircle,
  RefreshCcw,
  Save,
  Settings,
  ShieldCheck,
  User
} from 'lucide-react'
import { supabase } from './supabaseClient'

const ACTIONS = {
  OPENING_BALANCE: 'Opening Balance',
  ADD: 'Add Stock',
  REMOVE: 'Remove Stock',
  TRANSFER_IN: 'Transfer In',
  TRANSFER_OUT: 'Transfer Out',
  ADMIN_ADJUSTMENT: 'Admin Adjustment',
  MONTHLY_ADJUSTMENT: 'Monthly Adjustment'
}

const ADMIN_TABS = new Set(['setup'])

const getRoute = () => window.location.hash.replace('#/', '') || 'dashboard'

function moneylessNumber(value) {
  const n = Number(value || 0)
  return Number.isInteger(n) ? n.toString() : n.toFixed(2)
}

function monthStart() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

function keyFor(itemId, locationId) {
  return `${itemId}|${locationId}`
}

function downloadCsv(filename, rows) {
  if (!rows.length) return
  const headers = Object.keys(rows[0])
  const escape = (v) => `"${String(v ?? '').replaceAll('"', '""')}"`
  const csv = [headers.join(','), ...rows.map((row) => headers.map((h) => escape(row[h])).join(','))].join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function AuthScreen() { /* unchanged */
  const [mode, setMode] = useState('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  async function submit(e) { e.preventDefault(); setLoading(true); setMessage(''); const result = mode === 'signin' ? await supabase.auth.signInWithPassword({ email, password }) : await supabase.auth.signUp({ email, password }); setLoading(false); if (result.error) setMessage(result.error.message); else if (mode === 'signup') setMessage('Account created. If email confirmation is enabled, check your email before signing in.') }
  return <div className="authShell"><div className="authCard"><div className="brandMark"><ShieldCheck size={32} /></div><h1>Inventory Control</h1><p>No PHI. Guided inventory transactions. Protected audit trail.</p><form onSubmit={submit} className="authForm"><label>Email</label><input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required placeholder="you@example.com" /><label>Password</label><input value={password} onChange={(e) => setPassword(e.target.value)} type="password" minLength={6} required placeholder="Minimum 6 characters" /><button className="primaryButton" disabled={loading}>{loading ? 'Working...' : mode === 'signin' ? 'Sign In' : 'Create Account'}</button></form>{message && <div className="notice">{message}</div>}<button className="linkButton" onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')}>{mode === 'signin' ? 'Need an account? Create one' : 'Already have an account? Sign in'}</button></div></div>
}

const SelectField = ({ label, value, onChange, children }) => <label className="field"><span>{label}</span><select value={value} onChange={(e) => onChange(e.target.value)} required>{children}</select></label>
const NumberField = ({ label, value, onChange, min = 0 }) => <label className="field"><span>{label}</span><input value={value} min={min} onChange={(e) => onChange(e.target.value)} type="number" step="0.01" required /></label>
const TextField = ({ label, value, onChange, placeholder = '' }) => <label className="field"><span>{label}</span><input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} /></label>
const StatCard = ({ icon, label, value, tone = 'blue' }) => <div className={`statCard ${tone}`}><div className="statIcon">{icon}</div><div><strong>{value}</strong><span>{label}</span></div></div>

function App() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [active, setActive] = useState(getRoute())
  const [profile, setProfile] = useState(null)
  const [items, setItems] = useState([])
  const [locations, setLocations] = useState([])
  const [pars, setPars] = useState([])
  const [transactions, setTransactions] = useState([])
  const [counts, setCounts] = useState([])
  const [toast, setToast] = useState('')

  const role = profile?.role || 'staff'
  const isAdmin = role === 'admin'

  useEffect(() => {
    const sync = () => setActive(getRoute())
    window.addEventListener('hashchange', sync)
    return () => window.removeEventListener('hashchange', sync)
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setLoading(false) })
    const { data: sub } = supabase.auth.onAuthStateChange((_event, nextSession) => setSession(nextSession))
    return () => sub.subscription.unsubscribe()
  }, [])

  useEffect(() => { if (session) loadAll() }, [session])

  async function loadAll() {
    setLoading(true)
    const [{ data: p, error: pErr }, i, l, pl, t, c] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', session.user.id).maybeSingle(),
      supabase.from('items').select('*').order('name'),
      supabase.from('locations').select('*').order('name'),
      supabase.from('par_levels').select('*'),
      supabase.from('transactions').select('*').order('created_at', { ascending: false }),
      supabase.from('monthly_counts').select('*').order('created_at', { ascending: false })
    ])
    const err = [pErr, i.error, l.error, pl.error, t.error, c.error].find(Boolean)
    if (pErr) setToast('Profile not found. Ask an admin to run role migration.')
    if (err && !pErr) setToast(`Supabase error: ${err.message}. Did you run the migration SQL?`)
    setProfile(p || { email: session.user.email, role: 'staff' })
    setItems((i.data || []).filter((row) => row.active !== false || isAdmin))
    setLocations((l.data || []).filter((row) => row.active !== false || isAdmin))
    setPars(pl.data || [])
    setTransactions(t.data || [])
    setCounts(c.data || [])
    setLoading(false)
  }

  const balances = useMemo(() => transactions.reduce((acc, tx) => { const k = keyFor(tx.item_id, tx.location_id); acc[k] = (acc[k] || 0) + Number(tx.quantity || 0); return acc }, {}), [transactions])
  const itemName = (id) => items.find((x) => x.id === id)?.name || 'Unknown item'
  const locationName = (id) => locations.find((x) => x.id === id)?.name || 'Unknown location'
  const balanceFor = (itemId, locationId) => balances[keyFor(itemId, locationId)] || 0

  async function insertTransaction(tx) {
    const { error } = await supabase.from('transactions').insert({ ...tx, user_id: session.user.id })
    if (error) return setToast(error.message), false
    setToast('Saved successfully.'); await loadAll(); return true
  }

  if (loading && !session) return <div className="loading">Loading...</div>
  if (!session) return <AuthScreen />

  const nav = [['dashboard', 'Dashboard', <BarChart3 size={18} />], ['add', 'Add Stock', <PlusCircle size={18} />], ['remove', 'Remove Stock', <MinusCircle size={18} />], ['transfer', 'Transfer', <ArrowLeftRight size={18} />], ['monthly', 'Monthly Count', <ClipboardCheck size={18} />], ['setup', 'Setup / Par', <Settings size={18} />], ['history', 'History', <History size={18} />]]
  const blocked = ADMIN_TABS.has(active) && !isAdmin

  return <div className="appShell"><aside className="sidebar"><div className="logo"><div><Boxes size={26} /></div><span>Inventory<br />Control</span></div><nav>{nav.map(([id, label, icon]) => <button key={id} className={active === id ? 'active' : ''} onClick={() => { window.location.hash = `/${id}` }}>{icon}{label}</button>)}</nav><div className="sideFooter"><User size={16} /> <span>{session.user.email}</span><small>{isAdmin ? 'Admin view' : 'Staff view'}</small><button onClick={() => supabase.auth.signOut()}><LogOut size={16} /> Sign out</button></div></aside><main className="main"><header className="topbar"><div><h1>{nav.find(([id]) => id === active)?.[1] || 'Dashboard'}</h1><p>Guided workflows, par levels, monthly counts, and a protected transaction history.</p></div><button className="ghostButton" onClick={loadAll}><RefreshCcw size={16} /> Refresh</button></header>{toast && <div className="toast"><span>{toast}</span><button onClick={() => setToast('')}>×</button></div>}{blocked ? <section className="panel"><div className="warning"><Lock size={18} /> Admin access required for setup tools.</div></section> : <>
    {active === 'dashboard' && <Dashboard items={items} locations={locations} pars={pars} transactions={transactions} counts={counts} balanceFor={balanceFor} itemName={itemName} locationName={locationName} />}
    {active === 'add' && <TransactionFormBase mode="ADD" items={items} locations={locations} insertTransaction={insertTransaction} balanceFor={balanceFor} />}
    {active === 'remove' && <TransactionFormBase mode="REMOVE" items={items} locations={locations} insertTransaction={insertTransaction} balanceFor={balanceFor} />}
    {active === 'transfer' && <TransferStock items={items} locations={locations} session={session} loadAll={loadAll} setToast={setToast} balanceFor={balanceFor} />}
    {active === 'monthly' && <MonthlyCount items={items} locations={locations} session={session} loadAll={loadAll} setToast={setToast} balanceFor={balanceFor} />}
    {active === 'setup' && <Setup isAdmin={isAdmin} items={items} locations={locations} pars={pars} loadAll={loadAll} setToast={setToast} balanceFor={balanceFor} insertTransaction={insertTransaction} />}
    {active === 'history' && <HistoryView transactions={transactions} itemName={itemName} locationName={locationName} />}
  </>}</main></div>
}

function Dashboard({ items, locations, pars, transactions, counts, balanceFor, itemName, locationName }) { const belowPar = pars.map((p) => ({ ...p, current: balanceFor(p.item_id, p.location_id) })).filter((p) => Number(p.current) < Number(p.par_level)); const corrections = transactions.filter((t) => ['ADMIN_ADJUSTMENT', 'MONTHLY_ADJUSTMENT'].includes(t.action)).slice(0, 10); const noParSet = items.length * locations.length - pars.length; const recentTx = transactions.slice(0, 5); return <div className="gridStack"><section className="statsGrid"><StatCard tone="red" icon={<AlertTriangle />} label="Below Par" value={belowPar.length} /><StatCard tone="orange" icon={<ClipboardCheck />} label="Recent Counts" value={counts.length} /><StatCard tone="purple" icon={<History />} label="Corrections / Adjustments" value={corrections.length} /><StatCard tone="green" icon={<CheckCircle2 />} label="No Par Set" value={Math.max(noParSet, 0)} /></section><section className="panel"><div className="panelTitle"><h2>Reorder / Below Par</h2></div><div className="tableWrap"><table><thead><tr><th>Item</th><th>Location</th><th>Current</th><th>Par</th><th>Target</th><th>Suggested</th></tr></thead><tbody>{belowPar.length ? belowPar.map((p) => <tr key={p.id}><td>{itemName(p.item_id)}</td><td>{locationName(p.location_id)}</td><td className="dangerText">{moneylessNumber(p.current)}</td><td>{moneylessNumber(p.par_level)}</td><td>{moneylessNumber(p.target_level)}</td><td><strong>{Math.max(Number(p.target_level) - Number(p.current), 0)}</strong></td></tr>) : <tr><td colSpan="6" className="empty">Nothing is below par.</td></tr>}</tbody></table></div></section><section className="twoCol"><div className="panel"><div className="panelTitle"><h2>Recent Activity</h2></div><ActivityList rows={recentTx} itemName={itemName} locationName={locationName} /></div><div className="panel"><div className="panelTitle"><h2>Recent Corrections</h2></div><ActivityList rows={corrections.slice(0, 5)} itemName={itemName} locationName={locationName} /></div></section></div> }

function ActivityList({ rows, itemName, locationName }) { if (!rows.length) return <div className="empty">No activity yet.</div>; return <div className="activityList">{rows.map((t) => <div key={t.id} className="activity"><span className={Number(t.quantity) < 0 ? 'pill red' : 'pill green'}>{ACTIONS[t.action] || t.action}</span><strong>{itemName(t.item_id)}</strong><small>{locationName(t.location_id)} · Qty {moneylessNumber(t.quantity)} · {new Date(t.created_at).toLocaleString()}</small></div>)}</div> }

function TransactionFormBase({ mode, items, locations, insertTransaction, balanceFor }) { const [itemId, setItemId] = useState(''); const [locationId, setLocationId] = useState(''); const [quantity, setQuantity] = useState(''); const [reason, setReason] = useState(mode === 'ADD' ? 'Received stock' : 'Inventory removal'); const [notes, setNotes] = useState(''); const current = itemId && locationId ? balanceFor(itemId, locationId) : 0; const q = Number(quantity || 0); const signedQty = mode === 'REMOVE' ? -Math.abs(q) : Math.abs(q); const invalidRemove = mode === 'REMOVE' && q > Number(current); async function save(e) { e.preventDefault(); if (invalidRemove) return; const ok = await insertTransaction({ item_id: itemId, location_id: locationId, action: mode, quantity: signedQty, reason, notes }); if (ok) { setQuantity(''); setNotes('') } } return <section className="workflow panel"><div className="panelTitle"><h2>{mode === 'ADD' ? 'Add Stock' : 'Remove Stock'}</h2></div><form onSubmit={save} className="formGrid"><SelectField label="Item" value={itemId} onChange={setItemId}><option value="">Choose item...</option>{items.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}</SelectField><SelectField label="Location" value={locationId} onChange={setLocationId}><option value="">Choose location...</option>{locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</SelectField><NumberField label="Quantity" value={quantity} onChange={setQuantity} /><TextField label="Reason" value={reason} onChange={setReason} /><label className="field full"><span>Notes — no PHI</span><textarea value={notes} onChange={(e) => setNotes(e.target.value)} /></label>{invalidRemove && <div className="warning full"><AlertTriangle size={18} /> Cannot remove more than current balance.</div>}<button className="primaryButton full" disabled={!itemId || !locationId || !q || invalidRemove}><Save size={18} /> Save Transaction</button></form></section> }

function TransferStock({ items, locations, session, loadAll, setToast, balanceFor }) { const [itemId, setItemId] = useState(''); const [fromId, setFromId] = useState(''); const [toId, setToId] = useState(''); const [quantity, setQuantity] = useState(''); const [notes, setNotes] = useState(''); const current = itemId && fromId ? balanceFor(itemId, fromId) : 0; const q = Number(quantity || 0); const invalid = !itemId || !fromId || !toId || fromId === toId || !q || q > current; async function save(e) { e.preventDefault(); if (invalid) return; const { error } = await supabase.from('transactions').insert([{ user_id: session.user.id, item_id: itemId, location_id: fromId, action: 'TRANSFER_OUT', quantity: -Math.abs(q), reason: 'Transfer out', notes }, { user_id: session.user.id, item_id: itemId, location_id: toId, action: 'TRANSFER_IN', quantity: Math.abs(q), reason: 'Transfer in', notes }]); if (error) setToast(error.message); else { setToast('Transfer saved.'); setQuantity(''); setNotes(''); await loadAll() } } return <section className="panel workflow"><div className="panelTitle"><h2>Transfer Stock</h2></div><form onSubmit={save} className="formGrid"><SelectField label="Item" value={itemId} onChange={setItemId}><option value="">Choose item...</option>{items.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}</SelectField><SelectField label="From Location" value={fromId} onChange={setFromId}><option value="">Choose source...</option>{locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</SelectField><SelectField label="To Location" value={toId} onChange={setToId}><option value="">Choose destination...</option>{locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</SelectField><NumberField label="Quantity" value={quantity} onChange={setQuantity} />{q > current && <div className="warning full"><AlertTriangle size={18} /> Cannot transfer more than current source balance.</div>}<button className="primaryButton full" disabled={invalid}><ArrowLeftRight size={18} /> Save Transfer</button></form></section> }

function MonthlyCount({ items, locations, session, loadAll, setToast, balanceFor }) { const [itemId, setItemId] = useState(''); const [locationId, setLocationId] = useState(''); const [physical, setPhysical] = useState(''); const [countMonth, setCountMonth] = useState(monthStart()); const [notes, setNotes] = useState(''); const systemBalance = itemId && locationId ? balanceFor(itemId, locationId) : 0; const difference = Number(physical || 0) - Number(systemBalance); async function save(e) { e.preventDefault(); const { data, error } = await supabase.from('monthly_counts').insert({ user_id: session.user.id, count_month: countMonth, item_id: itemId, location_id: locationId, system_balance: systemBalance, physical_count: Number(physical), difference, notes }).select().single(); if (error) return setToast(error.message); if (difference !== 0) { const txRes = await supabase.from('transactions').insert({ user_id: session.user.id, item_id: itemId, location_id: locationId, action: 'MONTHLY_ADJUSTMENT', quantity: difference, reason: 'Monthly physical count adjustment', notes, monthly_count_id: data.id }); if (txRes.error) return setToast(txRes.error.message) } setToast('Count saved.'); setPhysical(''); setNotes(''); await loadAll() } return <section className="panel workflow"><div className="panelTitle"><h2>Monthly Count</h2></div><form onSubmit={save} className="formGrid"><label className="field"><span>Count Month</span><input type="date" value={countMonth} onChange={(e) => setCountMonth(e.target.value)} /></label><SelectField label="Item" value={itemId} onChange={setItemId}><option value="">Choose item...</option>{items.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}</SelectField><SelectField label="Location" value={locationId} onChange={setLocationId}><option value="">Choose location...</option>{locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</SelectField><NumberField label="Physical Count" value={physical} onChange={setPhysical} /><label className="field full"><span>Notes required if count is off — no PHI</span><textarea value={notes} onChange={(e) => setNotes(e.target.value)} /></label><button className="primaryButton full" disabled={!itemId || !locationId || physical === '' || (difference !== 0 && !notes.trim())}><ClipboardCheck size={18} /> Save Count</button></form></section> }

function Setup({ isAdmin, items, locations, pars, loadAll, setToast, balanceFor, insertTransaction }) { const [itemName, setItemName] = useState(''); const [category, setCategory] = useState('Medication'); const [locationName, setLocationName] = useState(''); const [parItem, setParItem] = useState(''); const [parLocation, setParLocation] = useState(''); const [par, setPar] = useState(''); const [target, setTarget] = useState(''); const [adjItem, setAdjItem] = useState(''); const [adjLocation, setAdjLocation] = useState(''); const [desiredBalance, setDesiredBalance] = useState(''); const [adjReason, setAdjReason] = useState(''); if (!isAdmin) return null; async function addItem(e) { e.preventDefault(); const { error } = await supabase.from('items').insert({ name: itemName, category }); if (error) setToast(error.message); else { setToast('Item added.'); setItemName(''); await loadAll() } } async function addLocation(e) { e.preventDefault(); const { error } = await supabase.from('locations').insert({ name: locationName }); if (error) setToast(error.message); else { setToast('Location added.'); setLocationName(''); await loadAll() } } async function savePar(e) { e.preventDefault(); const { error } = await supabase.from('par_levels').upsert({ item_id: parItem, location_id: parLocation, par_level: Number(par), target_level: Number(target) }, { onConflict: 'item_id,location_id' }); if (error) setToast(error.message); else { setToast('Par level saved.'); await loadAll() } } async function saveAdjustment(e) { e.preventDefault(); const current = balanceFor(adjItem, adjLocation); const desired = Number(desiredBalance); const delta = desired - current; if (!adjReason.trim()) return setToast('Reason is required for admin adjustments.'); const hasOpening = pars.some(() => false); const action = current === 0 ? 'OPENING_BALANCE' : 'ADMIN_ADJUSTMENT'; const ok = await insertTransaction({ item_id: adjItem, location_id: adjLocation, action, quantity: delta, reason: adjReason, notes: `Desired balance ${desired}` }); if (ok) { setDesiredBalance(''); setAdjReason('') } } const itemMap = Object.fromEntries(items.map(i => [i.id, i.name])); const locMap = Object.fromEntries(locations.map(l => [l.id, l.name])); return <div className="gridStack"><section className="twoCol"><form className="panel formStack" onSubmit={addItem}><div className="panelTitle"><h2>Add Item</h2></div><TextField label="Item Name" value={itemName} onChange={setItemName} /><TextField label="Category" value={category} onChange={setCategory} /><button className="primaryButton"><PackagePlus size={18} /> Add Item</button></form><form className="panel formStack" onSubmit={addLocation}><div className="panelTitle"><h2>Add Location</h2></div><TextField label="Location Name" value={locationName} onChange={setLocationName} /><button className="primaryButton"><Database size={18} /> Add Location</button></form></section><form className="panel formGrid" onSubmit={savePar}><div className="panelTitle full"><h2>Set Par / Target Level</h2></div><SelectField label="Item" value={parItem} onChange={setParItem}><option value="">Choose item...</option>{items.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}</SelectField><SelectField label="Location" value={parLocation} onChange={setParLocation}><option value="">Choose location...</option>{locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</SelectField><NumberField label="Par Level" value={par} onChange={setPar} /><NumberField label="Target Level" value={target} onChange={setTarget} /><button className="primaryButton full"><Save size={18} /> Save Par Level</button></form><form className="panel formGrid" onSubmit={saveAdjustment}><div className="panelTitle full"><h2>Admin Opening / Adjustment</h2><p>Creates OPENING_BALANCE or ADMIN_ADJUSTMENT transactions only.</p></div><SelectField label="Item" value={adjItem} onChange={setAdjItem}><option value="">Choose item...</option>{items.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}</SelectField><SelectField label="Location" value={adjLocation} onChange={setAdjLocation}><option value="">Choose location...</option>{locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</SelectField><NumberField label="Desired New Balance" value={desiredBalance} onChange={setDesiredBalance} /><TextField label="Required Reason" value={adjReason} onChange={setAdjReason} placeholder="Inventory correction reason" /><button className="primaryButton full" disabled={!adjItem || !adjLocation || desiredBalance === '' || !adjReason.trim()}><Save size={18} /> Save Adjustment Transaction</button></form><section className="panel"><div className="panelTitle"><h2>Current Par Levels</h2></div><div className="tableWrap"><table><thead><tr><th>Item</th><th>Location</th><th>Current</th><th>Par</th><th>Target</th></tr></thead><tbody>{pars.map((p) => <tr key={p.id}><td>{itemMap[p.item_id]}</td><td>{locMap[p.location_id]}</td><td>{moneylessNumber(balanceFor(p.item_id, p.location_id))}</td><td>{moneylessNumber(p.par_level)}</td><td>{moneylessNumber(p.target_level)}</td></tr>)}</tbody></table></div></section></div> }

function HistoryView({ transactions, itemName, locationName }) { const rows = transactions.map((t) => ({ created_at: t.created_at, action: t.action, item: itemName(t.item_id), location: locationName(t.location_id), quantity: t.quantity, reason: t.reason || '', notes: t.notes || '' })); return <section className="panel"><div className="panelTitle horizontal"><div><h2>Protected Transaction History</h2><p><Lock size={14} /> Transactions are append-only from the app.</p></div><button className="ghostButton" onClick={() => downloadCsv('inventory-transactions.csv', rows)}>Export CSV</button></div><div className="tableWrap"><table><thead><tr><th>Date</th><th>Action</th><th>Item</th><th>Location</th><th>Qty</th><th>Reason</th><th>Notes</th></tr></thead><tbody>{transactions.map((t) => <tr key={t.id}><td>{new Date(t.created_at).toLocaleString()}</td><td>{ACTIONS[t.action] || t.action}</td><td>{itemName(t.item_id)}</td><td>{locationName(t.location_id)}</td><td className={Number(t.quantity) < 0 ? 'dangerText' : 'successText'}>{Number(t.quantity) > 0 ? '+' : ''}{moneylessNumber(t.quantity)}</td><td>{t.reason}</td><td>{t.notes}</td></tr>)}</tbody></table></div></section> }

export default App
