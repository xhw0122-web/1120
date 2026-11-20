# 和美食地圖

用互動地圖探索彰化縣和美鎮的在地小吃、早餐、正餐、甜點冰品與飲料。網站採 React、Vite、TypeScript 和 Leaflet，可部署到靜態網站主機。

## 啟動網站

需要 Node.js 22.12 以上，開發時使用 Node.js 24。

```sh
npm ci
npm run dev
```

開啟終端機顯示的網址。使用 `npm run build` 檢查型別並產生 `dist/`，再用 `npm run preview` 預覽正式建置。瀏覽器定位需要 HTTPS 或 localhost。只有使用者按下「找我附近」才會請求定位，座標留在頁面記憶體。

若雲端環境的 npm 預設快取目錄無法寫入，安裝時可使用 `npm ci --cache /tmp/hemei-npm`。

## 新增店家

編輯 [public/data/places.json](public/data/places.json)，在陣列新增一個物件：

| 欄位 | 填寫方式 |
| --- | --- |
| `id` | 唯一且穩定的識別字串 |
| `name`、`address` | 店名與包含彰化縣和美鎮的完整地址 |
| `category` | 在地小吃、早餐、正餐、甜點冰品、飲料擇一 |
| `alsoCategories` | 可省略。店家也供應其他類型餐點時加入適用的類別 |
| `dishes` | 有來源可查證的餐點名稱陣列，缺資料時填 `[]` |
| `latitude`、`longitude` | 以十進位數值填入與地址相符的 WGS84 座標 |
| `hours`、`price` | 用台灣繁體中文描述，缺資料時填 `null` |
| `source`、`checkedOn` | 資料來源 URL 與查證日期，日期格式為 `YYYY-MM-DD`。示範資料可填 `null` |
| `sourceUpdatedOn` | 可省略。填入來源所載的單筆資料更新日期 |
| `demo` | 真實店家填 `false`。示範店家填 `true`，網站會標示並停用導航 |

新增後使用店名、餐點或地址測試搜尋，點擊地圖標記並確認導航目的地。正式發布前，請以店家公開資訊或其他可信來源核對門牌及經緯度。

## 資料來源

- 首批 9 筆店家資料來自 [交通部觀光署觀光資訊資料庫的餐飲資料](https://data.gov.tw/dataset/7779) 2026-10-30 開放資料快照。[可重現的公開快照](https://github.com/hunglun2026/lun-food/blob/8c5f300617ff18486e5bbaa20d7ca49b45bc6587/scripts/fixtures/Restaurant-json.zip) 由 lun-food 保存。門牌及座標取自同一筆紀錄，並檢查座標位於和美鎮界內。營業時間保留來源所列的時間，卡片附上查證日期與來源更新日期，價格待確認。
- 街道底圖來自 [OpenStreetMap](https://www.openstreetmap.org/copyright)。街道圖磚無法載入時，切換至隨網站提供的行政區界，地圖標記、店家清單及篩選仍可使用。
- 備用行政區界取自內政部[村里界圖](https://data.gov.tw/dataset/7438)，透過 [Taiwan Atlas](https://github.com/dkaoster/taiwan-atlas) 取得。已擷取和美鎮及鄰近區域。
- 首頁餐點照片為情境圖。
