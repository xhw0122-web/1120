import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Crosshair, Layers, List, MapPin, Minus, Plus, X } from 'lucide-react'
import L from 'leaflet'
import type { FeatureCollection } from 'geojson'
import districts from './districts.json'
import { coordinates, type Place, type Position } from './places'

const center: Position = [24.1097, 120.5017]
const startZoom = 15
const townshipStyle = ['#e5ecd9', '#e8eedc', '#e2ead6', '#eaf0e0']

type Props = {
  places: Place[]
  activePlace: Place | null
  selection: { id: string; from: 'list' | 'map' } | null
  position: Position | null
  visible: boolean
  onSelect: (id: string) => void
  onClose: () => void
  onShowList: () => void
  detail: ReactNode
  notice: string
  noticeAction: string
  onNoticeAction?: () => void
}

function districtLayer() {
  return L.geoJSON(districts as FeatureCollection, {
    interactive: false,
    style: feature => {
      const inHemei = feature?.properties?.town === '和美鎮'
      const name = String(feature?.properties?.name ?? '')
      const shade = Array.from(name).reduce((sum, char) => sum + char.charCodeAt(0), 0) % townshipStyle.length
      return {
        color: inHemei ? '#a8b99d' : '#c5cbb7',
        weight: inHemei ? 1.05 : 0.8,
        fillColor: inHemei ? townshipStyle[shade] : '#edf0e4',
        fillOpacity: 0.95,
      }
    },
    onEachFeature: (feature, layer) => {
      if (layer instanceof L.Polygon && feature.properties.town === '和美鎮') {
        const label = document.createElement('span')
        label.textContent = feature.properties.name
        layer.bindTooltip(label, { permanent: true, direction: 'center', className: 'district-label' })
      }
    },
  })
}

function pinIcon(active: boolean) {
  return L.divIcon({
    className: 'food-pin-anchor',
    html: `<span class="food-pin${active ? ' is-active' : ''}"><span></span></span>`,
    iconSize: [32, 38],
    iconAnchor: [16, 36],
    tooltipAnchor: [0, -30],
  })
}

function FoodMap({
  places, activePlace, selection, position, visible,
  onSelect, onClose, onShowList, detail, notice, noticeAction, onNoticeAction,
}: Props) {
  const container = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const markerLayer = useRef<L.LayerGroup | null>(null)
  const userLayer = useRef<L.LayerGroup | null>(null)
  const markers = useRef(new Map<string, L.Marker>())
  const selectRef = useRef(onSelect)
  const [base, setBase] = useState<'loading' | 'street' | 'district' | 'offline'>('loading')
  selectRef.current = onSelect

  useEffect(() => {
    if (!container.current) return
    let map: L.Map | undefined
    let resize: ResizeObserver | undefined
    try {
      map = L.map(container.current, {
        zoomControl: false,
        scrollWheelZoom: false,
        minZoom: 10,
        maxZoom: 19,
        attributionControl: false,
      }).setView(center, startZoom)
      const instance = map
      mapRef.current = instance
      const tilesPane = instance.createPane('streetTiles')
      tilesPane.style.zIndex = '450'
      const fallbackLabels = instance.getPane('tooltipPane')
      districtLayer().addTo(instance)
      const tiles = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        pane: 'streetTiles', maxZoom: 19,
        opacity: 0,
      }).addTo(instance)
      const syncBase = () => {
        const visibleTiles = tiles.getContainer()?.querySelectorAll('img.leaflet-tile-loaded') ?? []
        const streetReady = visibleTiles.length > 0
        tiles.setOpacity(streetReady ? 1 : 0)
        fallbackLabels?.classList.toggle('street-labels', streetReady)
        setBase(streetReady ? 'street' : 'district')
      }
      tiles.on('load', syncBase)
      markerLayer.current = L.layerGroup().addTo(instance)
      userLayer.current = L.layerGroup().addTo(instance)
      resize = new ResizeObserver(() => instance.invalidateSize({ pan: false }))
      resize.observe(container.current)
    } catch {
      map?.remove()
      map = undefined
      mapRef.current = null
      setBase('offline')
    }
    return () => {
      resize?.disconnect()
      map?.remove()
      mapRef.current = null
      markerLayer.current = null
      userLayer.current = null
    }
  }, [])

  useEffect(() => {
    const layer = markerLayer.current
    if (!layer) return
    layer.clearLayers()
    markers.current.clear()
    for (const place of places) {
      const name = document.createElement('span')
      name.textContent = place.name
      const marker = L.marker(coordinates(place), {
        icon: pinIcon(false), title: place.name, alt: place.name, riseOnHover: true,
      }).on('click', () => selectRef.current(place.id))
        .bindTooltip(name, { direction: 'top', offset: [0, -8], className: 'place-tooltip' })
        .addTo(layer)
      marker.getElement()?.setAttribute('aria-label', place.name)
      marker.getElement()?.addEventListener('keydown', event => {
        if (event.key === ' ' || event.key === 'Enter') {
          event.preventDefault()
          event.stopPropagation()
          selectRef.current(place.id)
        }
      })
      markers.current.set(place.id, marker)
    }
  }, [places])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !map.getContainer().clientWidth) return
    map.invalidateSize({ pan: false })
    for (const [id, marker] of markers.current) {
      const active = id === activePlace?.id
      const element = marker.getElement()
      element?.querySelector('.food-pin')?.classList.toggle('is-active', active)
      element?.setAttribute('aria-pressed', String(active))
      marker.setZIndexOffset(active ? 1000 : 0)
    }
    if (activePlace && selection) {
      const zoom = Math.max(map.getZoom(), 16)
      const point = map.project(coordinates(activePlace), zoom)
      const verticalOffset = map.getSize().x < 580 ? map.getSize().y * 0.21 : 0
      map.setView(map.unproject(point.add([0, verticalOffset]), zoom), zoom, { animate: false })
    } else {
      const points = (position ? places.slice(0, 4) : places).map(coordinates)
      if (position && map.distance(center, position) < 8_000) points.push(position)
      if (points.length === 1) map.setView(points[0], startZoom)
      if (points.length > 1) {
        map.fitBounds(L.latLngBounds(points), { padding: [42, 48], maxZoom: startZoom, animate: false })
      }
    }
  }, [activePlace, places, position, selection, visible])

  useEffect(() => {
    const map = mapRef.current
    const layer = userLayer.current
    if (!map || !layer) return
    layer.clearLayers()
    if (position) {
      L.circleMarker(position, { radius: 8, color: '#fff', weight: 3, fillColor: '#245fa2', fillOpacity: 1 })
        .bindTooltip('你的位置').addTo(layer)
    }
  }, [position])

  const { name, category, demo } = activePlace ?? {}
  return (
    <section id="food-map" className="map-panel" aria-label="和美鎮美食地圖">
      <div ref={container} className="leaflet-map" tabIndex={0} aria-label="和美鎮互動地圖，可用方向鍵移動" />
      {base === 'offline' ? (
        <div className="map-offline">
          <Layers size={26} />
          <p>地圖暫時無法載入</p>
          <button type="button" onClick={onShowList}>查看店家清單</button>
        </div>
      ) : (
        <>
          <span className="map-location"><MapPin size={15} aria-hidden="true" />和美鎮</span>
          <div className="map-controls">
            <div>
              <button type="button" aria-label="放大地圖" title="放大" onClick={() => mapRef.current?.zoomIn()}><Plus size={20} /></button>
              <button type="button" aria-label="縮小地圖" title="縮小" onClick={() => mapRef.current?.zoomOut()}><Minus size={20} /></button>
            </div>
            <button type="button" aria-label="回到和美鎮" title="回到和美鎮" onClick={() => mapRef.current?.setView(center, startZoom)}><Crosshair size={18} /></button>
          </div>
          <div className="map-meta">
            {base === 'district' && <span className="map-status" role="status"><Layers size={13} />街道底圖暫時無法載入，顯示行政區界</span>}
            {base === 'street'
              ? <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap contributors</a>
              : <a href="https://github.com/dkaoster/taiwan-atlas" target="_blank" rel="noreferrer">區界資料 © 內政部・Taiwan Atlas</a>}
          </div>
        </>
      )}
      {notice && base !== 'offline' && (
        <div className="map-notice" role="status">
          {notice}
          {onNoticeAction && <button type="button" onClick={onNoticeAction}>{noticeAction}</button>}
        </div>
      )}
      {activePlace && (
        <aside className="map-detail" aria-label={`${name}店家資訊`}>
          <div className="map-detail-title">
            <div>
              <span className="place-kicker">{category}{demo && <span className="demo-tag">示範</span>}</span>
              <h3>{name}</h3>
            </div>
            <button type="button" aria-label="關閉店家資訊" onClick={onClose}><X size={19} /></button>
          </div>
          {detail}
          <button className="map-show-list" type="button" onClick={onShowList}><List size={15} />在清單中查看</button>
        </aside>
      )}
    </section>
  )
}

export default FoodMap
