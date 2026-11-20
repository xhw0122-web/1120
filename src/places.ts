import { Coffee, CupSoda, Grid2X2, IceCreamCone, Soup, Utensils } from 'lucide-react'

export const categories = {
  '在地小吃': { icon: Soup, tone: 'terracotta' },
  '早餐': { icon: Coffee, tone: 'ochre' },
  '正餐': { icon: Utensils, tone: 'green' },
  '甜點冰品': { icon: IceCreamCone, tone: 'plum' },
  '飲料': { icon: CupSoda, tone: 'blue' },
} as const

export const AllIcon = Grid2X2
export type Category = keyof typeof categories
export type Filter = Category | '全部'
export type Position = [number, number]
export type Place = {
  id: string
  name: string
  category: Category
  alsoCategories?: Category[]
  dishes: string[]
  address: string
  latitude: number
  longitude: number
  hours: string | null
  price: string | null
  source: string | null
  checkedOn: string | null
  sourceUpdatedOn?: string
  demo: boolean
}

function isPlace(value: unknown): value is Place {
  if (!value || typeof value !== 'object') return false
  const place = value as Place
  return typeof place.id === 'string' && place.id.length > 0
    && typeof place.name === 'string' && place.name.length > 0
    && Object.hasOwn(categories, place.category)
    && (place.alsoCategories === undefined || (Array.isArray(place.alsoCategories)
      && place.alsoCategories.every(category => Object.hasOwn(categories, category))))
    && Array.isArray(place.dishes) && place.dishes.every(dish => typeof dish === 'string')
    && typeof place.address === 'string'
    && Number.isFinite(place.latitude) && Math.abs(place.latitude) <= 90
    && Number.isFinite(place.longitude) && Math.abs(place.longitude) <= 180
    && [place.hours, place.price, place.checkedOn].every(text => text === null || typeof text === 'string')
    && (place.sourceUpdatedOn === undefined || typeof place.sourceUpdatedOn === 'string')
    && (place.source === null || (typeof place.source === 'string' && /^https?:\/\//i.test(place.source)))
    && typeof place.demo === 'boolean'
}

export async function loadPlaces(signal: AbortSignal): Promise<Place[]> {
  const response = await fetch(import.meta.env.BASE_URL + 'data/places.json', { signal, cache: 'no-cache' })
  if (!response.ok) throw new Error('店家資料暫時無法載入')
  const data: unknown = await response.json()
  if (!Array.isArray(data) || !data.every(isPlace) || new Set(data.map(place => place.id)).size !== data.length) {
    throw new Error('店家資料格式錯誤')
  }
  return data
}

export const coordinates = (place: Place): Position => [place.latitude, place.longitude]

export function matches(place: Place, filter: Filter, query: string) {
  if (filter !== '全部' && place.category !== filter && !place.alsoCategories?.includes(filter)) return false
  const normalize = (value: string) => value.normalize('NFKC').toLocaleLowerCase('zh-TW').replaceAll('台', '臺')
  const content = normalize([place.name, place.address, ...place.dishes].join(' '))
  return normalize(query).trim().split(/\s+/).every(term => content.includes(term))
}

export function directions(place: Place) {
  const params = new URLSearchParams({ api: '1', destination: coordinates(place).join(',') })
  return 'https://www.google.com/maps/dir/?' + params
}
