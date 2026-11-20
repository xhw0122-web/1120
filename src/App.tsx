import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowUpRight, ChevronRight, Clock3, Compass, Crosshair, List, Map as MapIcon,
  MapPin, Search, Utensils, X,
} from 'lucide-react'
import FoodMap from './FoodMap'
import {
  AllIcon, categories, coordinates, directions, loadPlaces, matches,
  type Category, type Filter, type Place, type Position,
} from './places'

const filters = ['全部', ...Object.keys(categories) as Category[]] satisfies Filter[]
type Selection = { id: string; from: 'list' | 'map' }
type LoadState = { status: 'loading' | 'error' } | { status: 'ready'; places: Place[] }

function Brand() {
  return (
    <a className="brand" href="./" aria-label="和美食地圖首頁">
      <span className="brand-mark"><Utensils size={19} strokeWidth={2.3} aria-hidden="true" /></span>
      <span>和美<span className="brand-accent">食</span>地圖</span>
    </a>
  )
}

function PlaceDetails({ place }: { place: Place }) {
  return (
    <div className="place-details">
      <dl>
        <div><dt><Utensils size={15} />推薦餐點</dt><dd>{place.dishes.join('、') || '待確認'}</dd></div>
        <div><dt><MapPin size={15} />地址</dt><dd>{place.address || '待確認'}</dd></div>
        <div><dt><Clock3 size={15} />營業時間</dt><dd>{place.hours || '待確認'}</dd></div>
        <div><dt><span className="currency-icon">＄</span>價格帶</dt><dd>{place.price || '待確認'}</dd></div>
      </dl>
      {place.source && (
        <>
          <p className="source-line">
            <a href={place.source} target="_blank" rel="noreferrer">查看資料來源 <ArrowUpRight size={12} /></a>
            {place.checkedOn && <span>查證日期 {place.checkedOn}</span>}
          </p>
          {place.sourceUpdatedOn && <p className="source-note">來源更新於 {place.sourceUpdatedOn}，營業時間以店家公告為準。</p>}
        </>
      )}
      {place.demo ? (
        <button className="directions" disabled><MapPin size={15} /> 開啟 Google 地圖導航 <span>示範資料</span></button>
      ) : (
        <a className="directions" href={directions(place)} target="_blank" rel="noreferrer">
          <MapPin size={15} /> 開啟 Google 地圖導航 <ArrowUpRight size={15} />
        </a>
      )}
    </div>
  )
}

function PlaceCard({ place, selected, onSelect }: { place: Place; selected: boolean; onSelect: () => void }) {
  const { icon: Icon, tone } = categories[place.category]
  return (
    <article className={`place-card${selected ? ' is-selected' : ''}`} id={`place-${place.id}`}>
      <button className="place-trigger" type="button" aria-expanded={selected} onClick={onSelect}>
        <span className={`category-icon tone-${tone}`}><Icon size={21} strokeWidth={1.75} aria-hidden="true" /></span>
        <span className="place-content">
          <span className="place-kicker">{place.category}{place.demo && <span className="demo-tag">示範</span>}</span>
          <span className="place-name">{place.name}</span>
          <span className="place-dishes">{place.dishes.join('、') || '推薦餐點待確認'}</span>
          <span className="place-address"><MapPin size={13} aria-hidden="true" />{place.address || '地址待確認'}</span>
        </span>
        <ChevronRight className="place-chevron" size={17} aria-hidden="true" />
      </button>
      {selected && <PlaceDetails place={place} />}
    </article>
  )
}

function App() {
  const [loadState, setLoadState] = useState<LoadState>({ status: 'loading' })
  const [attempt, setAttempt] = useState(0)
  const [filter, setFilter] = useState<Filter>('全部')
  const [query, setQuery] = useState('')
  const [view, setView] = useState<'map' | 'list'>('map')
  const [selection, setSelection] = useState<Selection | null>(null)
  const [position, setPosition] = useState<Position | null>(null)
  const [locating, setLocating] = useState(false)
  const [locationMessage, setLocationMessage] = useState('')
  const listRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const controller = new AbortController()
    loadPlaces(controller.signal).then(places => setLoadState({ status: 'ready', places })).catch(() => {
      if (!controller.signal.aborted) setLoadState({ status: 'error' })
    })
    return () => controller.abort()
  }, [attempt])

  const places = useMemo(() => {
    if (loadState.status !== 'ready') return []
    const results = loadState.places.filter(place => matches(place, filter, query))
    if (position) results.sort((a, b) => distance(position, coordinates(a)) - distance(position, coordinates(b)))
    return results
  }, [filter, loadState, position, query])
  const activePlace = places.find(place => place.id === selection?.id) ?? null
  const hasDemos = loadState.status === 'ready' && loadState.places.some(place => place.demo)
  const onlyDemos = hasDemos && loadState.status === 'ready' && loadState.places.every(place => place.demo)

  useEffect(() => {
    if (selection?.from !== 'map') return
    const list = listRef.current
    const card = document.getElementById(`place-${selection.id}`)
    if (list && card && list.clientHeight && list.scrollHeight > list.clientHeight) {
      list.scrollTop += card.getBoundingClientRect().top - list.getBoundingClientRect().top - 8
    }
  }, [selection, view])

  useEffect(() => {
    if (selection?.from === 'list' && view === 'map' && window.matchMedia('(max-width: 720px)').matches) {
      document.getElementById('food-map')?.scrollIntoView({ block: 'nearest' })
    }
  }, [selection, view])

  function requestLocation() {
    if (!navigator.geolocation) {
      setLocationMessage('目前的瀏覽器無法定位，你仍可搜尋和美的店家。')
      return
    }
    setLocating(true)
    setLocationMessage('')
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setPosition([coords.latitude, coords.longitude])
        setSelection(null)
        setLocationMessage('已依距離排列店家。')
        setLocating(false)
      },
      ({ code }) => {
        setLocationMessage(code === 1
          ? '定位權限未開啟，你仍可搜尋和美的店家。'
          : '暫時找不到你的位置，你仍可搜尋和美的店家。')
        setLocating(false)
      },
      { timeout: 10_000, maximumAge: 30_000 },
    )
  }

  function resetFilters() {
    setFilter('全部')
    setQuery('')
    setSelection(null)
  }

  return (
    <>
      <a href="#explore" className="skip-link">跳到店家探索</a>
      <header className="site-header">
        <div className="header-inner">
          <Brand />
          <span className="locale"><MapPin size={15} aria-hidden="true" />彰化縣・和美鎮</span>
        </div>
      </header>

      <main className="shell">
        <section className="hero" aria-labelledby="hero-title">
          <div className="hero-copy">
            <div className="eyebrow"><span />彰化・和美在地飲食指南</div>
            <h1 id="hero-title">今天在和美吃什麼？</h1>
            <p>從早起的蛋餅到午後的剉冰，打開地圖找一口和美好味道。</p>
          </div>
        </section>

        <section className="toolbar" aria-label="搜尋和美美食">
          <div className="search-row">
            <div className="search-field" role="search">
              <Search size={20} aria-hidden="true" />
              <input
                ref={searchRef}
                type="search"
                aria-label="搜尋店名、餐點或地址"
                placeholder="搜尋店名、餐點或地址"
                value={query}
                onChange={event => { setQuery(event.target.value); setSelection(null) }}
              />
              {query && <button type="button" className="clear-search" aria-label="清除搜尋" onClick={() => {
                setQuery('')
                setSelection(null)
                searchRef.current?.focus()
              }}><X size={17} /></button>}
            </div>
            <button className="nearby" type="button" onClick={requestLocation} disabled={locating}>
              <Crosshair size={18} aria-hidden="true" />
              {locating ? '定位中…' : '找我附近'}
            </button>
          </div>
          <div className="filter-row" role="group" aria-label="餐飲類別">
            {filters.map(item => {
              const Icon = item === '全部' ? AllIcon : categories[item].icon
              return <button key={item} type="button" aria-pressed={filter === item} onClick={() => { setFilter(item); setSelection(null) }}>
                <Icon size={16} strokeWidth={1.9} aria-hidden="true" />
                {item}
              </button>
            })}
          </div>
          {locationMessage && <p className="location-message" role="status">{locationMessage}</p>}
        </section>

        <section id="explore" className="explore" aria-labelledby="explore-title" tabIndex={-1}>
          <div className="explore-heading">
            <div className="explore-title">
              <span className="section-mark"><Compass size={19} strokeWidth={1.8} aria-hidden="true" /></span>
              <h2 id="explore-title">探索和美</h2>
            </div>
            {hasDemos && (
              <span className="demo-notice" title="示範店家為虛構資料，僅供體驗網站功能。">
                <span />{onlyDemos ? '目前顯示示範資料' : '含示範資料'}
              </span>
            )}
          </div>

          <div className="view-switch" role="group" aria-label="瀏覽方式">
            <button type="button" aria-pressed={view === 'map'} onClick={() => setView('map')}><MapIcon size={17} />地圖</button>
            <button type="button" aria-pressed={view === 'list'} onClick={() => setView('list')}><List size={17} />清單</button>
          </div>

          <div className="explore-grid" data-view={view}>
            <section className="list-panel" aria-labelledby="list-title">
              <div className="list-header">
                <h3 id="list-title"><List size={17} aria-hidden="true" />店家清單</h3>
                <span aria-live="polite">{loadState.status === 'ready' ? `${places.length} 間店家` : ''}</span>
              </div>
              <div className="place-list" ref={listRef}>
                {loadState.status === 'loading' && <p className="list-state" role="status">正在載入店家…</p>}
                {loadState.status === 'error' && <div className="list-state">
                  <p role="alert">店家資料暫時無法載入。</p>
                  <button type="button" onClick={() => { setLoadState({ status: 'loading' }); setAttempt(previous => previous + 1) }}>重新載入</button>
                </div>}
                {loadState.status === 'ready' && !places.length && (
                  <div className="list-state"><Search size={24} aria-hidden="true" /><p>找不到符合的店家</p>
                    {(query || filter !== '全部') && <button type="button" onClick={resetFilters}>清除篩選</button>}
                  </div>
                )}
                {places.map(place => <PlaceCard key={place.id} place={place} selected={activePlace?.id === place.id}
                  onSelect={() => {
                    setSelection(activePlace?.id === place.id && view === 'map' ? null : { id: place.id, from: 'list' })
                    setView('map')
                  }}
                />)}
              </div>
            </section>

            <FoodMap
              places={places}
              activePlace={activePlace}
              selection={selection}
              position={position}
              visible={view === 'map'}
              onSelect={id => setSelection({ id, from: 'map' })}
              onClose={() => setSelection(null)}
              onShowList={() => setView('list')}
              detail={activePlace && <PlaceDetails place={activePlace} />}
              notice={loadState.status === 'error' ? '店家資料暫時無法載入。'
                : loadState.status === 'ready' && !places.length ? '找不到符合的店家' : ''}
              onNoticeAction={loadState.status === 'error'
                ? () => { setLoadState({ status: 'loading' }); setAttempt(previous => previous + 1) }
                : (query || filter !== '全部') ? resetFilters : undefined}
              noticeAction={loadState.status === 'error' ? '重新載入' : '清除篩選'}
            />
          </div>
        </section>

        <footer className="footer">
          <span><Utensils size={15} aria-hidden="true" />和美食地圖</span>
          <span>彰化縣和美鎮</span>
        </footer>
      </main>
    </>
  )
}

function distance([latitude, longitude]: Position, [otherLatitude, otherLongitude]: Position) {
  const radians = Math.PI / 180
  const halfLatitude = Math.sin((otherLatitude - latitude) * radians / 2)
  const halfLongitude = Math.sin((otherLongitude - longitude) * radians / 2)
  return halfLatitude ** 2 + Math.cos(latitude * radians) * Math.cos(otherLatitude * radians) * halfLongitude ** 2
}

export default App
