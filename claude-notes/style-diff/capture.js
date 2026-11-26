// Renders real screens in headless Brave and dumps the computed style of every element.
// usage: node capture.js <out.json> [light]
const CDP = require('/Users/ulises/Documents/picolove/focalboard/webapp/node_modules/chrome-remote-interface')
const {spawn} = require('child_process')
const fs = require('fs')

const OUT = process.argv[2]
const THEME = process.argv[3] || 'pico'
const WIDTH = Number(process.env.WIDTH || 1400)
const BASE = 'http://localhost:8123'
const data = JSON.parse(fs.readFileSync('/tmp/vis_data.json', 'utf8'))
const BRAVE = '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser'
const PORT = 9333 + Math.floor(Math.random() * 400)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const SNAP = `(() => {
  const props = Array.from(getComputedStyle(document.documentElement));
  const sig = (el) => el.tagName.toLowerCase() + (el.classList.length ? '.' + Array.from(el.classList).sort().join('.') : '');
  const out = {};
  const counts = {};
  const walk = (el, path) => {
    if (['SCRIPT','STYLE','LINK','META','TITLE','HEAD','NOSCRIPT'].includes(el.tagName)) return;
    const s = sig(el);
    counts[path + '>' + s] = (counts[path + '>' + s] || 0) + 1;
    const key = path + '>' + s + '#' + counts[path + '>' + s];
    const cs = getComputedStyle(el);
    const o = {};
    for (const p of props) o[p] = cs.getPropertyValue(p);
    out[key] = o;
    for (const pseudo of ['::before', '::after']) {
      const ps = getComputedStyle(el, pseudo);
      if (ps.content && ps.content !== 'none' && ps.content !== 'normal') {
        const po = {};
        for (const p of props) po[p] = ps.getPropertyValue(p);
        out[key + pseudo] = po;
      }
    }
    for (const c of el.children) walk(c, key);
  };
  walk(document.body, '');
  return out;
})()`

async function main() {
    const chrome = spawn(BRAVE, ['--headless=new', `--remote-debugging-port=${PORT}`, '--user-data-dir=/tmp/brave-vis-' + PORT, '--window-size=1400,900', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--hide-scrollbars', 'about:blank'], {stdio: 'ignore'})
    let client
    for (let i = 0; i < 40; i++) {
        try { client = await CDP({port: PORT}); break } catch (e) { await sleep(250) }
    }
    if (!client) throw new Error('could not connect to the browser')
    const {Page, Runtime, Emulation} = client
    await Page.enable(); await Runtime.enable()
    await Emulation.setDeviceMetricsOverride({width: WIDTH, height: 900, deviceScaleFactor: 1, mobile: false})
    const ev = async (expression) => {
        const r = await Runtime.evaluate({expression, returnByValue: true, awaitPromise: true})
        if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails).slice(0, 300))
        return r.result.value
    }
    const nav = async (url) => { await Page.navigate({url}); await sleep(2200) }
    const result = {}
    const snap = async (name) => { result[name] = await ev(SNAP) }
    const click = async (sel, nth = 0) => ev(`(() => { const e = document.querySelectorAll(${JSON.stringify(sel)})[${nth}]; if (!e) return false; e.click(); return true })()`)
    const hover = async (sel) => ev(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (!e) return false; e.dispatchEvent(new MouseEvent('mouseover', {bubbles: true})); e.dispatchEvent(new MouseEvent('mouseenter')); return true })()`)
    const key = async (k) => ev(`document.dispatchEvent(new KeyboardEvent('keydown', {key: ${JSON.stringify(k)}, bubbles: true}))`)

    await nav(BASE + '/login')
    await ev(`localStorage.clear()`)
    if (THEME === 'light') {
        await ev(`localStorage.setItem('theme', JSON.stringify({mainBg:'255, 255, 255', mainFg:'55, 53, 47', buttonBg:'80, 170, 221', buttonFg:'255, 255, 255', sidebarBg:'247, 246, 243', sidebarFg:'55, 53, 47'}))`)
    }
    await nav(BASE + '/login'); await snap('login')
    await nav(BASE + '/register'); await snap('register')
    await ev(`localStorage.setItem('focalboardSessionId', ${JSON.stringify(data.token)})`)

    const boards = data.boards
    for (const [bname, b] of Object.entries(boards)) {
        for (const [vid, type, title] of b.views) {
            await nav(`${BASE}/team/0/${b.board}/${vid}`)
            await snap(`${bname}|view:${type}:${title}`)
        }
        if (b.cards[0]) {
            const v0 = b.views[0][0]
            await nav(`${BASE}/team/0/${b.board}/${v0}/${b.cards[0]}`)
            await snap(`${bname}|card-dialog`)
        }
    }

    // interactions on the Project Tasks board view
    const pt = boards['Project Tasks']
    const boardView = pt.views[0][0]
    const tableView = pt.views.find((v) => v[1] === 'table')[0]
    const calView = pt.views.find((v) => v[1] === 'calendar')[0]
    const stateOf = async (name, fn) => { try { await fn(); await sleep(700); await snap(name) } catch (e) { result[name] = {error: String(e).slice(0, 200)} } finally { await key('Escape'); await ev('document.body.click()'); await sleep(300) } }

    await nav(`${BASE}/team/0/${pt.board}/${boardView}`)
    await stateOf('ix|filter-popup', () => click('.ViewHeader .Button', 0))
    const clicks = [
        ['ix|view-menu', '.ViewHeader .view-menu, .ViewHeader .MenuWrapper'],
        ['ix|share-dialog', '.ShareBoardButton button'],
        ['ix|sidebar-add-board', '.Sidebar .add-board'],
        ['ix|find-boards', '.BoardsSwitcher'],
        ['ix|sidebar-user-menu', '.SidebarUserMenu .MenuWrapper'],
        ['ix|card-options-menu', '.KanbanCard .optionsMenu'],
        ['ix|column-menu', '.KanbanColumnHeader .MenuWrapper, .octo-board-header-cell .MenuWrapper'],
    ]
    for (const [name, sel] of clicks) {
        await stateOf(name, async () => { await nav(`${BASE}/team/0/${pt.board}/${boardView}`); await click(sel, 0) })
    }
    await stateOf('ix|kanban-hover-card', async () => { await nav(`${BASE}/team/0/${pt.board}/${boardView}`); await hover('.KanbanCard') })
    await stateOf('ix|table-header-menu', async () => { await nav(`${BASE}/team/0/${pt.board}/${tableView}`); await click('.TableHeaders .header-cell .MenuWrapper', 1) })
    await stateOf('ix|table-calculation', async () => { await nav(`${BASE}/team/0/${pt.board}/${tableView}`); await click('.CalculationRow .Calculation, .Calculation', 0) })
    await stateOf('ix|calendar-add', async () => { await nav(`${BASE}/team/0/${pt.board}/${calView}`); await click('.fc-event', 0) })
    await stateOf('ix|card-dialog-property-menu', async () => { await nav(`${BASE}/team/0/${pt.board}/${boardView}/${pt.cards[0]}`); await click('.CardDetail .MenuWrapper', 0) })

    fs.writeFileSync(OUT, JSON.stringify(result))
    console.log('saved', OUT, Object.keys(result).length, 'screens;', Object.values(result).reduce((n, s) => n + Object.keys(s).length, 0), 'elements')
    await client.close()
    chrome.kill()
}
main().catch((e) => { console.error(e); process.exit(1) })
