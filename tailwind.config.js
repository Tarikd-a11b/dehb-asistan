/**
 * Tailwind derleme yapılandırması.
 *
 * Sayfa eskiden `cdn.tailwindcss.com` yüklüyordu: 407 KB ham / 123 KB gzip
 * JavaScript indirip CSS'i HER AÇILIŞTA tarayıcıda derliyordu. Artık CSS bir
 * kez burada üretilip `tailwind.css` olarak servis ediliyor.
 *
 *   npm run build:css        # üretim (minified)
 *   npm run watch:css        # geliştirirken
 *
 * ⚠️ Yeni bir Tailwind sınıfı kullandığında CSS'i YENİDEN ÜRET. Üretmezsen
 * o sınıf dosyada olmaz ve öğe sessizce stilsiz kalır. `test/tailwind-guncel.test.js`
 * bunu yakalıyor.
 *
 * `content` neden `*.js`i de içeriyor: sınıf adlarının bir kısmı JS şablon
 * dizelerinde üretiliyor (tasks-view.js, doc-intake.js, dehb-info.js…).
 * Tailwind kaynağı düz metin olarak tarıyor; oradaki değerler TAM sınıf adı
 * literali olduğu için bulunuyorlar. Bu yüzden `'bg-' + renk` gibi parçalı
 * sınıf üretme — taranamaz.
 */
module.exports = {
  darkMode: 'class',                 // index.html'deki tailwind.config ile aynı
  content: [
    './index.html',
    './index_2.html',
    './auth.html',
    './*.js',
    '!./tailwind.config.js'
  ],
  theme: { extend: {} },
  plugins: []
};
