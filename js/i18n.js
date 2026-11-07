/** Every word on the page, in both languages. */
const DICT = {
  en: {
    title: 'Axioma — what needs no proof', desc: 'Axioma builds websites like this one. Scroll through nine scenes generated live in your browser, then send your request.',
    backToStart: 'Axioma, back to start', music: 'Music', musicOn: 'Music on', language: 'Switch language', nudge: 'Scroll down', loading: 'Loading',
    heroSub: 'What needs no proof.',
    orderK: 'Order', orderH: 'Even chaos follows a rule.', orderT: 'Three equations. One path that never repeats and never leaves its shape.',
    shipK: 'Machine', shipH: 'What can be built, eventually will be.', shipT: 'AX-1. Forty metres of chrome, one tokamak and a crew that won’t be back for two hundred years.',
    originK: 'Origin', originH: 'Everything that lives was written first.', originT: 'Four letters and three billion lines. Each copy unzips the last, and that has been enough for four billion years.',
    energyK: 'Energy', energyH: 'Nothing shines for free.', energyT: 'Nine thousand panels close around one star. Only a thin line of its light gets out, and night never falls here again.',
    holeK: 'Boundary', holeH: 'Past the horizon, proof runs out.', holeT: 'Light from the far side of the disc bends over the shadow. Time runs differently here, and the clocks agree.',
    scaleK: 'Scale', scaleH: 'Two hundred billion suns.', scaleT: 'One slow rotation takes a quarter of a billion years. Somewhere on an outer arm, something small is still asking why.',
    worldK: 'Continuity', worldH: 'Any world can be unwound.', worldT: 'Oceans, mountains and clouds become a single ribbon. The shape changes. The connection stays.',
    moonK: 'Silence', moonH: 'The far side has no signal.', moonT: 'Everything we know\nbegins with an assumption.',
    endK: 'Axioma',
    formH: 'Your website request', name: 'Name', phone: 'Phone', email: 'Email', send: 'Send request',
    errName: 'Enter your name', errPhone: 'Enter a valid phone number', errEmail: 'Enter a valid email', errSend: 'Something went wrong. Please try again.',
    after: 'Request sent. We’ll be in touch, {name}.', foot: 'Every scene and every note is generated in real time',
    tagA: 'Tokamak', tagAs: '41.7 MK · 24 coils', tagB: 'Habitat ring', tagBs: '0.8 g · 412 berths', tagC: 'Antenna', tagCs: '4.2-year signal delay', tagH: 'You are here', tagHs: 'Orion Arm, 26 kly out',
    noJs: 'This site needs JavaScript and WebGL2.', noGl: 'This browser can’t run WebGL2, which Axioma needs. Try a different browser.',
  },
  ru: {
    title: 'Axioma — то, что не требует доказательств', desc: 'Axioma создаёт такие сайты. Пролистайте девять сцен, которые рождаются прямо в браузере, и отправьте запрос.',
    backToStart: 'Axioma, в начало', music: 'Музыка', musicOn: 'Музыка вкл', language: 'Сменить язык', nudge: 'Листайте вниз', loading: 'Загрузка',
    heroSub: 'То, что не требует доказательств.',
    orderK: 'Порядок', orderH: 'Даже хаос следует правилу.', orderT: 'Три уравнения. Одна траектория, которая никогда не повторяется и никогда не покидает своей формы.',
    shipK: 'Машина', shipH: 'Всё, что возможно, однажды построят.', shipT: 'АКС-1. Сорок метров хрома, один токамак и экипаж, который не вернётся раньше, чем через двести лет.',
    originK: 'Исток', originH: 'Всё живое сначала было написано.', originT: 'Четыре буквы и три миллиарда строк. Каждая копия расплетает предыдущую, и этого хватает уже четыре миллиарда лет.',
    energyK: 'Энергия', energyH: 'Ничто не светит бесплатно.', energyT: 'Девять тысяч панелей смыкаются вокруг одной звезды. Наружу выходит лишь тонкая линия света, и ночь здесь больше не наступает.',
    holeK: 'Граница', holeH: 'За горизонтом доказательства заканчиваются.', holeT: 'Свет с дальней стороны диска огибает тень и виден сверху. Время здесь идёт иначе, и часы это подтверждают.',
    scaleK: 'Масштаб', scaleH: 'Двести миллиардов солнц.', scaleT: 'Один оборот занимает четверть миллиарда лет. Где-то на внешнем рукаве что-то маленькое всё ещё спрашивает зачем.',
    worldK: 'Связность', worldH: 'Любой мир можно развернуть.', worldT: 'Океаны, горы и облака становятся одной лентой. Меняется форма, а связность остаётся.',
    moonK: 'Тишина', moonH: 'На обратной стороне нет сигнала.', moonT: 'Всё, что мы знаем,\nначинается с допущения.',
    endK: 'Axioma',
    formH: 'Ваш запрос на создание сайта', name: 'Имя', phone: 'Телефон', email: 'Почта', send: 'Отправить запрос',
    errName: 'Введите имя', errPhone: 'Введите корректный номер', errEmail: 'Введите корректную почту', errSend: 'Что-то пошло не так. Попробуйте ещё раз.',
    after: 'Запрос отправлен. Мы свяжемся с вами, {name}.', foot: 'Каждая сцена и каждая нота создаются в реальном времени',
    tagA: 'Токамак', tagAs: '41,7 МК · 24 катушки', tagB: 'Жилое кольцо', tagBs: '0,8 g · 412 мест', tagC: 'Антенна', tagCs: 'Задержка сигнала 4,2 года', tagH: 'Вы здесь', tagHs: 'Рукав Ориона, 26 тыс. св. лет',
    noJs: 'Для этого сайта нужны JavaScript и WebGL2.', noGl: 'Этот браузер не поддерживает WebGL2. Попробуйте другой браузер.',
  },
};

const stored = () => { try { return localStorage.getItem('axioma-lang'); } catch { return null; } };
let lang = stored() || (/^(ru|uk|be|kk)/i.test(navigator.language || '') ? 'ru' : 'en');
const listeners = [];

export const t = k => DICT[lang][k] ?? k;
export const onLang = fn => listeners.push(fn);

export function applyLang() {
  const root = document.documentElement;
  root.lang = lang;
  document.title = t('title');
  document.querySelector('meta[name=description]').content = t('desc');
  for (const el of document.querySelectorAll('[data-t]')) el.textContent = t(el.dataset.t);
  for (const el of document.querySelectorAll('[data-t-label]')) el.setAttribute('aria-label', t(el.dataset.tLabel));
  for (const b of document.querySelectorAll('#lang b')) b.classList.toggle('on', b.dataset.l === lang);
  listeners.forEach(fn => fn());
}

export function toggleLang() {
  lang = lang === 'en' ? 'ru' : 'en';
  try { localStorage.setItem('axioma-lang', lang); } catch { /* private mode: the choice lasts for this visit */ }
  applyLang();
}
