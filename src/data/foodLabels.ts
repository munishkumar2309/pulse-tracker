// Labels of the on-phone food photo model → Pulse dishes (src/data/dishes.ts).
// Model: dima806/indian_food_image_detection (ViT, 80 Indian dishes, Apache-2.0). Labels are read from the
// model's own config at run time, so the order here does not matter; unknown labels fall back to a search.
// `approx`: no exact dish in Pulse, so the closest one is offered and labelled "closest match".
// Docs: docs/HEALTH.md → Food photo recognition. Check against scripts/export-food-model.py's labels.json.

export interface LabelInfo { name: string; dishes: string[]; approx?: boolean }

const L = (name: string, dishes: string[] = [], approx = false): LabelInfo => ({ name, dishes, ...(approx ? { approx } : {}) })

export const FOOD_LABELS: Record<string, LabelInfo> = {
  adhirasam: L('Adhirasam'),
  aloo_gobi: L('Aloo gobi', ['Aloo gobi']),
  aloo_matar: L('Aloo matar', ['Aloo matar']),
  aloo_methi: L('Aloo methi', ['Aloo sabzi'], true),
  aloo_shimla_mirch: L('Aloo shimla mirch', ['Aloo sabzi'], true),
  aloo_tikki: L('Aloo tikki', ['Aloo tikki']),
  anarsa: L('Anarsa'),
  ariselu: L('Ariselu'),
  bandar_laddu: L('Bandar laddu', ['Besan ladoo'], true),
  basundi: L('Basundi', ['Basundi']),
  bhatura: L('Bhatura', ['Bhatura']),
  bhindi_masala: L('Bhindi masala', ['Bhindi masala']),
  biryani: L('Biryani', ['Veg biryani', 'Chicken biryani', 'Mutton biryani']),
  boondi: L('Boondi', ['Boondi ladoo'], true),
  butter_chicken: L('Butter chicken', ['Butter chicken']),
  chak_hao_kheer: L('Chak hao kheer', ['Kheer'], true),
  cham_cham: L('Cham cham', ['Rasgulla'], true),
  chana_masala: L('Chana masala', ['Chole']),
  chapati: L('Chapati', ['Roti / chapati', 'Phulka (no ghee)']),
  chhena_kheeri: L('Chhena kheeri', ['Kheer'], true),
  chicken_razala: L('Chicken rezala', ['Chicken curry'], true),
  chicken_tikka: L('Chicken tikka', ['Chicken tikka']),
  chicken_tikka_masala: L('Chicken tikka masala', ['Butter chicken', 'Chicken curry'], true),
  chikki: L('Chikki', ['Peanut chikki']),
  daal_baati_churma: L('Dal baati churma', ['Dal baati churma']),
  daal_puri: L('Dal puri', ['Puri'], true),
  dal_makhani: L('Dal makhani', ['Dal makhani']),
  dal_tadka: L('Dal tadka', ['Dal tadka (toor)']),
  dharwad_pedha: L('Dharwad pedha', ['Pedha']),
  doodhpak: L('Doodhpak', ['Kheer'], true),
  double_ka_meetha: L('Double ka meetha'),
  dum_aloo: L('Dum aloo', ['Dum aloo']),
  gajar_ka_halwa: L('Gajar ka halwa', ['Gajar ka halwa']),
  gavvalu: L('Gavvalu'),
  ghevar: L('Ghevar'),
  gulab_jamun: L('Gulab jamun', ['Gulab jamun']),
  imarti: L('Imarti', ['Jalebi'], true),
  jalebi: L('Jalebi', ['Jalebi']),
  kachori: L('Kachori', ['Kachori']),
  kadai_paneer: L('Kadai paneer', ['Kadai paneer']),
  kadhi_pakoda: L('Kadhi pakoda', ['Kadhi']),
  kajjikaya: L('Kajjikaya'),
  kakinada_khaja: L('Kakinada khaja'),
  kalakand: L('Kalakand', ['Kalakand']),
  karela_bharta: L('Karela bharta', ['Baingan bharta'], true),
  kofta: L('Kofta', ['Malai kofta']),
  kuzhi_paniyaram: L('Kuzhi paniyaram', ['Unni appam'], true),
  lassi: L('Lassi', ['Sweet lassi']),
  ledikeni: L('Ledikeni', ['Gulab jamun'], true),
  litti_chokha: L('Litti chokha', ['Litti chokha']),
  lyangcha: L('Lyangcha', ['Gulab jamun'], true),
  maach_jhol: L('Maach jhol', ['Fish curry']),
  makki_di_roti_sarson_da_saag: L('Makki di roti, sarson da saag', ['Makki di roti', 'Sarson da saag']),
  malapua: L('Malpua', ['Malpua']),
  misi_roti: L('Missi roti', ['Roti / chapati'], true),
  misti_doi: L('Mishti doi', ['Mishti doi']),
  modak: L('Modak', ['Modak']),
  mysore_pak: L('Mysore pak', ['Mysore pak']),
  naan: L('Naan', ['Naan', 'Butter naan']),
  navrattan_korma: L('Navratan korma', ['Navratan korma']),
  palak_paneer: L('Palak paneer', ['Palak paneer']),
  paneer_butter_masala: L('Paneer butter masala', ['Paneer butter masala']),
  phirni: L('Phirni', ['Phirni']),
  pithe: L('Pithe'),
  poha: L('Poha', ['Poha']),
  poornalu: L('Poornalu'),
  pootharekulu: L('Pootharekulu'),
  qubani_ka_meetha: L('Qubani ka meetha'),
  rabri: L('Rabri', ['Rabri']),
  ras_malai: L('Ras malai', ['Ras malai']),
  rasgulla: L('Rasgulla', ['Rasgulla']),
  sandesh: L('Sandesh', ['Sandesh']),
  shankarpali: L('Shankarpali'),
  sheer_korma: L('Sheer korma', ['Kheer'], true),
  sheera: L('Sheera', ['Sooji halwa']),
  shrikhand: L('Shrikhand', ['Shrikhand']),
  sohan_halwa: L('Sohan halwa', ['Sooji halwa'], true),
  sohan_papdi: L('Soan papdi', ['Soan papdi']),
  sutar_feni: L('Sutar feni'),
  unni_appam: L('Unni appam', ['Unni appam']),
}

/** "Gulab Jamun", "gulab-jamun", "gulab_jamun" → "gulab_jamun". */
export const labelKey = (label: string) => label.toLowerCase().trim().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')

const titleCase = (key: string) => key.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase())

export function labelInfo(label: string): LabelInfo {
  return FOOD_LABELS[labelKey(label)] ?? L(titleCase(labelKey(label)))
}
