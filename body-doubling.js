/* ══════════════════════════════════════════════════════════════
   FocusAid — 👥 Sanal Body Doubling: Sherlock Holmes (Sinematik Animasyon)
   1. Çalışma Seansı: Masasında tüy kalemle yazan, büyüteçle inceleyen,
      piposu tüten, sarkaçlı saati sallanan canlı çalışma sahnesi.
   2. Mola Seansı: Masadan kalkıp odada kahvesiyle volta atan/yürüyen
      akıcı yürüme döngüsü (Walk Cycle).
   ══════════════════════════════════════════════════════════════ */

const BodyDoublingState = {
  isEnabled: true,
  companionName: 'Sherlock Holmes',
  status: 'working', // 'working', 'break'
  bubbleTimer: null,
  widget: null,        // widget referansi: PiP'e tasininca document'ta bulunamiyor
  pipPenceresi: null,  // acik Document Picture-in-Picture penceresi
  sureTimer: null      // ayri penceredeki kalan sure sayaci
};

const SHERLOCK_WORKING_QUOTES = [
  "Vaka dosyasındaki ipuçlarını inceliyorum, sen de odağını koru dostum 🔍",
  "Tüy kalemimle önemli detayları not alıyorum. Harika bir ritim yakaladın 📚",
  "221B Baker Street'teki masamdayım; sessizce yanındayım ☕",
  "Zihnimiz tam kapasite çalışıyor, bu seansı beraber bitireceğiz 🚀"
];

/* ── SİNEMATİK SAHNE DİLİ ────────────────────────────────────────
   Önceki sürüm düz renkli ve orantısızdı ("çocuk çizimi"). Gerçekçilik daha
   çok detaydan değil, şu dört karardan geliyor:

   1. TEK IŞIK KAYNAĞI (chiaroscuro). Her yüzeyin rengi, o yüzeyin lambadan ne
      kadar ışık aldığıyla belirleniyor; düz dolgu yok, her kütle gradyanlı.
      Karakter neredeyse siluet — onu fondan AYIRAN şey konturundaki sıcak
      "rim light". Bu yüzden yüzün içine göz/ağız çizmeye çalışmıyoruz:
      küçük ölçekte okunmayan detay yerine güçlü bir profil silueti.
   2. SICAK/SOĞUK KONTRAST. Sağda amber lamba, solda yağmurlu pencereden gelen
      soğuk mavi. Derinlik hissini büyük ölçüde bu taşıyor.
   3. ATMOSFERİK DERİNLİK. Arka plan (kitaplık, saat) bulanık ve düşük
      kontrast, orta plan (karakter) net, ön plan (masa) koyu. Sahnenin en
      parlak değeri masadaki kağıt: göz oraya gidiyor.
   4. ÇİZİM SIRASI = DERİNLİK. Karakter masanın ARKASINDA oturuyor, bu yüzden
      gövde masadan önce; ama eller masanın ÜSTÜNDE, bu yüzden kollar masadan
      sonra çiziliyor. İlk denemede kollar masadan önce çizilmişti ve büyüteç
      tamamen masanın altında kalıp görünmez olmuştu.

   viewBox 480x240 = 2:1 sinema oranı; kutuyu `slice` ile dolduruyor (eski
   3:2'de yanlarda siyah bant kalıyordu). Kritik öğeler ortadaki güvenli
   alanda; kırpma yalnızca üst/alt kenarı yiyor.

   ⚠️ Yürüyüş sahnesinde `.cw-volta`ya transform-origin ŞART. `scaleX(-1)`
   varsayılan origin'de (0,0) uygulanır ve figür dönüş karesinde odanın öbür
   ucuna ışınlanır. Origin figürün kendi merkezine sabitlendi.

   Filtreler (grain, blur) statik; her karede yeniden hesaplanmaz. Sahneler
   aynı anda DOM'da olmasa da id'ler yine sahneye özel öneklerle ayrıldı.
   ──────────────────────────────────────────────────────────────── */

// 🎬 1. ÇALIŞMA SAHNESİ — 221B Baker Street, gece. Lamba ışığında not alan Holmes.
function getSherlockStudyScene() {
  return `
    <svg viewBox="0 0 480 240" preserveAspectRatio="xMidYMid slice" class="w-full h-40 md:h-44 select-none">
      <defs>
        <linearGradient id="cs-duvar" x1="0%" y1="0%" x2="25%" y2="100%">
          <stop offset="0%" stop-color="#05070d"/>
          <stop offset="55%" stop-color="#0a0f1a"/>
          <stop offset="100%" stop-color="#141c28"/>
        </linearGradient>
        <radialGradient id="cs-lambaHale" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="#ffd9a0" stop-opacity="0.5"/>
          <stop offset="38%" stop-color="#f0a44a" stop-opacity="0.2"/>
          <stop offset="72%" stop-color="#b45309" stop-opacity="0.06"/>
          <stop offset="100%" stop-color="#000000" stop-opacity="0"/>
        </radialGradient>
        <linearGradient id="cs-huzme" x1="50%" y1="0%" x2="50%" y2="100%">
          <stop offset="0%" stop-color="#ffe0b0" stop-opacity="0.38"/>
          <stop offset="60%" stop-color="#ffc887" stop-opacity="0.1"/>
          <stop offset="100%" stop-color="#ffb266" stop-opacity="0"/>
        </linearGradient>
        <linearGradient id="cs-cam" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#16304f"/>
          <stop offset="55%" stop-color="#0e2138"/>
          <stop offset="100%" stop-color="#0a1626"/>
        </linearGradient>
        <linearGradient id="cs-palto" x1="100%" y1="15%" x2="20%" y2="95%">
          <stop offset="0%" stop-color="#2a3446"/>
          <stop offset="42%" stop-color="#151c29"/>
          <stop offset="100%" stop-color="#070b12"/>
        </linearGradient>
        <linearGradient id="cs-masa" x1="80%" y1="0%" x2="10%" y2="70%">
          <stop offset="0%" stop-color="#4a3520"/>
          <stop offset="42%" stop-color="#241a12"/>
          <stop offset="100%" stop-color="#0c0907"/>
        </linearGradient>
        <linearGradient id="cs-kagit" x1="85%" y1="0%" x2="10%" y2="100%">
          <stop offset="0%" stop-color="#f3e3bd"/>
          <stop offset="52%" stop-color="#cdb98e"/>
          <stop offset="100%" stop-color="#8f7f60"/>
        </linearGradient>
        <linearGradient id="cs-abajur" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#35855c"/>
          <stop offset="60%" stop-color="#14532d"/>
          <stop offset="100%" stop-color="#0a2e1a"/>
        </linearGradient>

        <filter id="cs-uzak" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="2.6"/>
        </filter>
        <filter id="cs-yumusak" x="-70%" y="-70%" width="240%" height="240%">
          <feGaussianBlur stdDeviation="5"/>
        </filter>
        <filter id="cs-golge" x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="10"/>
        </filter>
        <filter id="cs-grain">
          <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="3" seed="11"/>
          <feColorMatrix type="saturate" values="0"/>
        </filter>
        <!-- Yuzun isik alan kenarini kafanin ICINE hapseden kirpma yolu.
             Boylece profil konturunu kalin stroke'la boyayip isigin kenardan
             iceri dogru sonmesini elde ediyoruz; stroke disari tasmiyor. -->
        <clipPath id="cs-kafaKirp">
          <path d="M 274 54 C 286 46 306 50 311 63 C 314 71 313 76 310 79
                   L 319 88 L 309 91 C 308 94 310 96 308 98 C 305 102 308 104 305 107
                   C 300 112 288 112 282 107 C 277 102 275 92 275 80 C 274 68 272 60 274 54 Z"/>
        </clipPath>
        <radialGradient id="cs-vinyet" cx="52%" cy="55%" r="62%">
          <stop offset="0%" stop-color="#000" stop-opacity="0"/>
          <stop offset="62%" stop-color="#000" stop-opacity="0.14"/>
          <stop offset="100%" stop-color="#000" stop-opacity="0.74"/>
        </radialGradient>
      </defs>

      <style>
        /* Yazarken omuz-dirsek-bilek birlikte çalışır. Soldan sağa kısa
           vuruşlar, sonra satır başına dönüş — sadece bilek titretmek
           kukla gibi duruyordu. */
        @keyframes csYaz {
          0%, 100% { transform: translate(0,0) rotate(0deg); }
          16% { transform: translate(2px,-0.8px) rotate(1.4deg); }
          32% { transform: translate(4px,0.4px) rotate(-0.8deg); }
          48% { transform: translate(6px,-0.6px) rotate(1.8deg); }
          62% { transform: translate(8px,0.8px) rotate(-0.4deg); }
          66% { transform: translate(-1px,1.4px) rotate(-1.8deg); }
          84% { transform: translate(0.6px,0) rotate(0.4deg); }
        }
        @keyframes csIncele {
          0%, 100% { transform: translate(0,0) rotate(0deg); }
          38% { transform: translate(-8px,4px) rotate(-4deg); }
          64% { transform: translate(-10px,1px) rotate(-1.5deg); }
        }
        /* Nefes: figürü "canlı" yapan, neredeyse fark edilmeyen detay */
        @keyframes csNefes {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-1.3px); }
        }
        @keyframes csDuman {
          0%   { transform: translate(0,0) scale(0.45); opacity: 0; }
          18%  { opacity: 0.45; }
          100% { transform: translate(18px,-66px) scale(2.8); opacity: 0; }
        }
        @keyframes csSarkac {
          0%, 100% { transform: rotate(11deg); }
          50% { transform: rotate(-11deg); }
        }
        /* Gaz lambası sabit yanmaz; ışık çok hafif nefes alır */
        @keyframes csTitre {
          0%, 100% { opacity: 1; }
          42% { opacity: 0.94; }
          46% { opacity: 0.99; }
          70% { opacity: 0.91; }
        }
        @keyframes csToz {
          0%   { transform: translate(0,0); opacity: 0; }
          25%  { opacity: 0.65; }
          100% { transform: translate(-16px,-34px); opacity: 0; }
        }
        @keyframes csDamla {
          0%   { transform: translateY(-16px); opacity: 0; }
          20%  { opacity: 0.7; }
          100% { transform: translateY(84px); opacity: 0; }
        }

        .cs-yaz     { animation: csYaz 2.6s infinite ease-in-out; transform-origin: 334px 140px; }
        .cs-incele  { animation: csIncele 4.6s infinite ease-in-out; transform-origin: 272px 133px; }
        .cs-nefes   { animation: csNefes 4.4s infinite ease-in-out; }
        .cs-duman-1 { animation: csDuman 4.6s infinite ease-out; }
        .cs-duman-2 { animation: csDuman 4.6s infinite ease-out 1.6s; }
        .cs-duman-3 { animation: csDuman 4.6s infinite ease-out 3.1s; }
        .cs-sarkac  { animation: csSarkac 1.9s infinite ease-in-out; transform-origin: 62px 44px; }
        .cs-titre   { animation: csTitre 6s infinite ease-in-out; }
        .cs-toz-1   { animation: csToz 7s infinite linear; }
        .cs-toz-2   { animation: csToz 9s infinite linear 2.5s; }
        .cs-toz-3   { animation: csToz 8s infinite linear 4.5s; }
        .cs-damla-1 { animation: csDamla 2.8s infinite linear; }
        .cs-damla-2 { animation: csDamla 3.6s infinite linear 1.2s; }
        .cs-damla-3 { animation: csDamla 3.1s infinite linear 2.2s; }

        @media (prefers-reduced-motion: reduce) {
          .cs-yaz, .cs-incele, .cs-nefes, .cs-duman-1, .cs-duman-2, .cs-duman-3,
          .cs-sarkac, .cs-titre, .cs-toz-1, .cs-toz-2, .cs-toz-3,
          .cs-damla-1, .cs-damla-2, .cs-damla-3 { animation: none; }
        }
      </style>

      <!-- ═══ ARKA PLAN ═══ -->
      <rect width="480" height="240" fill="url(#cs-duvar)"/>
      <g opacity="0.05" fill="#93c5fd">
        <rect x="14" y="0" width="2" height="180"/><rect x="48" y="0" width="2" height="180"/>
        <rect x="82" y="0" width="2" height="180"/><rect x="116" y="0" width="2" height="180"/>
        <rect x="150" y="0" width="2" height="180"/><rect x="184" y="0" width="2" height="180"/>
        <rect x="218" y="0" width="2" height="180"/><rect x="252" y="0" width="2" height="180"/>
        <rect x="286" y="0" width="2" height="180"/><rect x="320" y="0" width="2" height="180"/>
        <rect x="354" y="0" width="2" height="180"/><rect x="388" y="0" width="2" height="180"/>
        <rect x="422" y="0" width="2" height="180"/><rect x="456" y="0" width="2" height="180"/>
      </g>

      <!-- Kitaplık: uzak plan, bulanık ve düşük kontrast -->
      <g filter="url(#cs-uzak)" opacity="0.8">
        <rect x="366" y="0" width="118" height="178" fill="#0b1017"/>
        <rect x="374" y="6" width="102" height="62" fill="#060a10"/>
        <g opacity="0.5">
          <rect x="379" y="18" width="7" height="48" rx="1" fill="#6b4a2f"/>
          <rect x="388" y="24" width="9" height="42" rx="1" fill="#7a5236"/>
          <rect x="399" y="15" width="6" height="51" rx="1" fill="#5c4a3a"/>
          <rect x="407" y="22" width="10" height="44" rx="1" fill="#6e4630"/>
          <rect x="419" y="17" width="7" height="49" rx="1" fill="#4f4234"/>
          <rect x="428" y="26" width="11" height="40" rx="1" fill="#78502f"/>
          <rect x="441" y="19" width="8" height="47" rx="1" fill="#5a3f2c"/>
          <rect x="451" y="23" width="9" height="43" rx="1" fill="#67492e"/>
        </g>
        <rect x="374" y="68" width="102" height="5" fill="#171f2a"/>
        <rect x="374" y="80" width="102" height="60" fill="#060a10"/>
        <g opacity="0.36">
          <rect x="380" y="92" width="9" height="44" rx="1" fill="#5c4130"/>
          <rect x="391" y="88" width="7" height="48" rx="1" fill="#6b4a2f"/>
          <rect x="400" y="96" width="10" height="40" rx="1" fill="#4a3b2e"/>
          <rect x="412" y="90" width="8" height="46" rx="1" fill="#6e5136"/>
          <rect x="422" y="98" width="11" height="38" rx="1" fill="#55402f"/>
        </g>
        <rect x="374" y="140" width="102" height="5" fill="#171f2a"/>
      </g>

      <!-- Sarkaçlı duvar saati -->
      <g filter="url(#cs-uzak)" opacity="0.85">
        <rect x="46" y="4" width="32" height="76" rx="4" fill="#0b1017" stroke="#1c2431" stroke-width="1.5"/>
        <circle cx="62" cy="26" r="11" fill="#141c26" stroke="#28313f" stroke-width="1.5"/>
        <circle cx="62" cy="26" r="8" fill="#0d131b"/>
        <line x1="62" y1="26" x2="62" y2="19" stroke="#8a949f" stroke-width="1.4" stroke-linecap="round"/>
        <line x1="62" y1="26" x2="67" y2="28" stroke="#8a949f" stroke-width="1.2" stroke-linecap="round"/>
        <g class="cs-sarkac">
          <line x1="62" y1="44" x2="62" y2="66" stroke="#5b4a2c" stroke-width="1.6"/>
          <circle cx="62" cy="68" r="4.5" fill="#8a6a35"/>
        </g>
      </g>

      <!-- ═══ YAĞMURLU PENCERE — sahnenin soğuk kutbu ═══ -->
      <g>
        <rect x="112" y="16" width="98" height="106" rx="3" fill="url(#cs-cam)"/>
        <circle cx="186" cy="50" r="15" fill="#fbbf24" opacity="0.15" filter="url(#cs-yumusak)"/>
        <circle cx="186" cy="50" r="3" fill="#fde68a" opacity="0.45"/>
        <g opacity="0.55">
          <rect class="cs-damla-1" x="130" y="22" width="1.6" height="13" rx="0.8" fill="#7dd3fc"/>
          <rect class="cs-damla-2" x="163" y="20" width="1.4" height="17" rx="0.7" fill="#7dd3fc"/>
          <rect class="cs-damla-3" x="196" y="24" width="1.6" height="11" rx="0.8" fill="#7dd3fc"/>
        </g>
        <rect x="158" y="16" width="5" height="106" fill="#0a0f18"/>
        <rect x="112" y="66" width="98" height="5" fill="#0a0f18"/>
        <rect x="108" y="12" width="106" height="114" rx="4" fill="none" stroke="#161e2a" stroke-width="7"/>
        <rect x="106" y="122" width="110" height="4" fill="#2b4a6b" opacity="0.45"/>
      </g>

      <!-- ═══ LAMBANIN ODAYA YAYDIĞI SICAK KÜRE ═══ -->
      <g class="cs-titre">
        <ellipse cx="416" cy="150" rx="165" ry="128" fill="url(#cs-lambaHale)"/>
      </g>

      <!-- Karakterin duvara düşen dev gölgesi (film noir) -->
      <ellipse cx="238" cy="140" rx="80" ry="72" fill="#000" opacity="0.45" filter="url(#cs-golge)"/>

      <!-- Koltuk arkalığı -->
      <path d="M 240 180 L 240 116 Q 240 96 266 94 L 322 94 Q 348 96 348 116 L 348 180 Z"
            fill="#0a0f16" stroke="#131a25" stroke-width="2"/>

      <!-- ═══ SHERLOCK — masanın ARKASINDA oturuyor ═══ -->
      <g class="cs-nefes">
        <!-- Palto gövdesi -->
        <path d="M 244 180
                 C 242 154 250 134 266 126
                 C 276 121 290 119 299 120
                 C 319 122 335 134 341 152
                 C 347 164 349 172 349 180 Z"
              fill="url(#cs-palto)"/>
        <!-- Yaka -->
        <path d="M 288 121 L 297 144 L 307 121" fill="#080c13"/>
        <path d="M 299 121 L 303 140 L 306 122" fill="#c9d3e0" opacity="0.42"/>
        <!-- Omuz konturundaki rim light: figürü fondan ayıran çizgi -->
        <path d="M 299 120 C 319 122 335 134 341 152 C 346 163 348 172 348 180"
              fill="none" stroke="#f0a44a" stroke-width="1.8" stroke-linecap="round" opacity="0.55"/>

        <!-- Boyun -->
        <path d="M 284 102 L 284 124 L 302 126 L 302 100 Z" fill="#0b1017"/>
        <path d="M 302 102 L 302 124" stroke="#c69567" stroke-width="1.4"
              stroke-linecap="round" opacity="0.4"/>

        <!-- Kafa: profilden gerçek yüz konturu (alın→burun→dudak→çene) -->
        <path d="M 274 54
                 C 286 46 306 50 311 63
                 C 314 71 313 76 310 79
                 L 319 88
                 L 309 91
                 C 308 94 310 96 308 98
                 C 305 102 308 104 305 107
                 C 300 112 288 112 282 107
                 C 277 102 275 92 275 80
                 C 274 68 272 60 274 54 Z"
              fill="#141b26"/>
        <!-- Yüz karanlıkta; ışık yalnızca profil kenarından içeri sönüyor.
             Genis duz ten dolgusu maske gibi duruyordu — kucuk olcekte
             okunmayan detay yerine guclu kenar. -->
        <g clip-path="url(#cs-kafaKirp)">
          <path d="M 311 63 C 314 71 313 76 310 79 L 319 88 L 309 91
                   C 308 94 310 96 308 98 C 305 102 308 104 305 107
                   C 302 110 297 112 292 112"
                fill="none" stroke="#8a6543" stroke-width="10" stroke-linecap="round" opacity="0.5"/>
          <path d="M 311 63 C 314 71 313 76 310 79 L 319 88 L 309 91
                   C 308 94 310 96 308 98 C 305 102 308 104 305 107
                   C 302 110 297 112 292 112"
                fill="none" stroke="#c69567" stroke-width="4.5" stroke-linecap="round" opacity="0.75"/>
          <!-- Elmacık kemiğinin üstündeki tek küçük vurgu -->
          <ellipse cx="303" cy="80" rx="4" ry="2.6" fill="#d9a273" opacity="0.3"/>
        </g>
        <!-- Profil konturu: sahnedeki en keskin ışık -->
        <path d="M 311 63 C 314 71 313 76 310 79 L 319 88 L 309 91
                 C 308 94 310 96 308 98 C 305 102 308 104 305 107
                 C 302 110 297 112 292 112"
              fill="none" stroke="#ffcf94" stroke-width="1.5" stroke-linecap="round" opacity="0.92"/>
        <!-- Göz çukuru: ışığın ulaşmadığı tek nokta -->
        <ellipse cx="301" cy="71" rx="4.5" ry="2.6" fill="#05080f" opacity="0.8"/>
        <!-- Bıyık -->
        <path d="M 297 95 L 306 97.5" stroke="#0a0d14" stroke-width="2.2" stroke-linecap="round" opacity="0.85"/>

        <!-- Deerstalker: kubbe + ön/arka siperlik -->
        <path d="M 268 62 C 264 44 280 33 293 35 C 307 37 316 47 314 64
                 C 306 55 282 54 268 62 Z" fill="#212a37"/>
        <path d="M 293 35 C 307 37 316 47 314 64 C 310 58 305 55 300 53
                 C 300 46 297 39 293 35 Z" fill="#38455a" opacity="0.75"/>
        <path d="M 313 60 C 324 59 332 63 331 67 C 326 69 318 67 312 65 Z" fill="#161d28"/>
        <path d="M 271 60 C 260 59 252 63 253 67 C 258 69 266 67 272 65 Z" fill="#131a24"/>
        <path d="M 270 58 C 273 44 285 35 293 36" fill="none" stroke="#f0a44a"
              stroke-width="1.5" stroke-linecap="round" opacity="0.4"/>

        <!-- Pipo -->
        <path d="M 305 98 L 319 104 C 324 106 324 112 319 114"
              fill="none" stroke="#4a2c15" stroke-width="2.8" stroke-linecap="round"/>
        <ellipse cx="321" cy="106" rx="3.8" ry="3" fill="#3a2210"/>
        <ellipse cx="321" cy="105" rx="2.2" ry="1.4" fill="#ff8c3a" opacity="0.75"/>
      </g>

      <!-- Pipo dumanı -->
      <g filter="url(#cs-yumusak)" opacity="0.45">
        <ellipse class="cs-duman-1" cx="322" cy="100" rx="4.4" ry="3.6" fill="#cbd5e1"/>
        <ellipse class="cs-duman-2" cx="324" cy="100" rx="3.6" ry="3" fill="#e2e8f0"/>
        <ellipse class="cs-duman-3" cx="321" cy="100" rx="5.2" ry="4" fill="#b8c2cf"/>
      </g>

      <!-- ═══ MASA (ön plan) — gövdenin alt yarısını kapatıyor ═══ -->
      <path d="M 0 182 L 480 176 L 480 240 L 0 240 Z" fill="url(#cs-masa)"/>
      <path d="M 0 182 L 480 176" fill="none" stroke="#8a6534" stroke-width="1.4" opacity="0.5"/>
      <!-- Lambanın masada bıraktığı sıcak havuz -->
      <ellipse cx="392" cy="204" rx="128" ry="22" fill="#ffb15e" opacity="0.15" filter="url(#cs-yumusak)"/>

      <!-- Üzerinde çalışılan vaka dosyası: sahnenin en parlak değeri -->
      <g transform="rotate(-2.5 250 196)">
        <rect x="192" y="182" width="122" height="32" rx="1.5" fill="url(#cs-kagit)"/>
        <g stroke="#5b4a33" stroke-linecap="round" opacity="0.6">
          <line x1="200" y1="190" x2="298" y2="190" stroke-width="1.3"/>
          <line x1="200" y1="197" x2="284" y2="197" stroke-width="1.1"/>
          <line x1="200" y1="204" x2="302" y2="204" stroke-width="1.1"/>
          <line x1="200" y1="211" x2="270" y2="211" stroke-width="1"/>
        </g>
      </g>
      <rect x="186" y="188" width="120" height="28" rx="1.5" fill="#b8a882" opacity="0.28"
            transform="rotate(2.5 250 196)"/>

      <!-- Mürekkep hokkası -->
      <ellipse cx="352" cy="196" rx="12" ry="4.5" fill="#090c12"/>
      <path d="M 340 196 L 343 185 L 361 185 L 364 196 Z" fill="#131a24"/>
      <ellipse cx="352" cy="185" rx="9" ry="3.6" fill="#05070c"/>
      <path d="M 345 183 A 9 3.6 0 0 1 354 182" fill="none" stroke="#7f8b9c" stroke-width="1.1" opacity="0.55"/>

      <!-- Yığılmış kitaplar (sol ön plan) -->
      <g opacity="0.92">
        <rect x="34" y="170" width="76" height="11" rx="1.5" fill="#3a2a1c"/>
        <rect x="40" y="159" width="68" height="11" rx="1.5" fill="#2c2116"/>
        <rect x="46" y="149" width="60" height="10" rx="1.5" fill="#43301f"/>
        <path d="M 34 170 L 110 170" stroke="#8a6534" stroke-width="1" opacity="0.3"/>
        <path d="M 46 149 L 106 149" stroke="#8a6534" stroke-width="0.9" opacity="0.25"/>
      </g>

      <!-- ═══ KOLLAR — masadan SONRA: eller masanın ÜSTÜNDE ═══ -->
      <!-- Sol kol: büyüteci belgenin üstünde gezdiriyor -->
      <g class="cs-incele">
        <path d="M 272 133 C 254 144 238 168 234 188"
              fill="none" stroke="#151d29" stroke-width="12.5" stroke-linecap="round"/>
        <path d="M 271 135 C 255 146 241 167 237 186"
              fill="none" stroke="#2f3a4d" stroke-width="2.4" stroke-linecap="round" opacity="0.4"/>
        <path d="M 232 190 L 222 196" stroke="#6b4a2f" stroke-width="4.5" stroke-linecap="round"/>
        <circle cx="233" cy="189" r="5.5" fill="#b98a5e"/>
        <circle cx="212" cy="202" r="15" fill="#dbeafe" opacity="0.12"/>
        <circle cx="212" cy="202" r="15" fill="none" stroke="#a9741f" stroke-width="3.2"/>
        <circle cx="212" cy="202" r="15" fill="none" stroke="#f0c27b" stroke-width="1.1" opacity="0.65"/>
        <path d="M 203 193 A 15 15 0 0 1 216 188" fill="none" stroke="#fff"
              stroke-width="1.8" stroke-linecap="round" opacity="0.38"/>
      </g>

      <!-- Sağ kol: tüy kalemle yazıyor -->
      <g class="cs-yaz">
        <path d="M 334 140 C 333 164 315 182 298 188"
              fill="none" stroke="#111823" stroke-width="12.5" stroke-linecap="round"/>
        <path d="M 335 142 C 334 163 317 180 301 186"
              fill="none" stroke="#2a3446" stroke-width="2.4" stroke-linecap="round" opacity="0.4"/>
        <circle cx="297" cy="189" r="5.5" fill="#b98a5e"/>
        <!-- Tüy kalem: elden yukarı-sağa uzanan tüy -->
        <path d="M 297 189 C 303 176 310 163 316 152
                 C 319 156 316 168 308 181 C 304 187 299 191 297 189 Z"
              fill="#ded8c9"/>
        <path d="M 297 189 C 303 177 310 164 315 153"
              fill="none" stroke="#8f8a7c" stroke-width="0.8" opacity="0.8"/>
        <path d="M 316 152 L 319 147" stroke="#ded8c9" stroke-width="1.4" stroke-linecap="round"/>
        <path d="M 297 189 L 294 195" stroke="#1c1710" stroke-width="1.8" stroke-linecap="round"/>
      </g>

      <!-- ═══ BANKACI LAMBASI ═══ -->
      <g class="cs-titre">
        <!-- Abajurdan masaya inen hacimli huzme -->
        <path d="M 386 142 L 450 142 L 478 208 L 358 208 Z" fill="url(#cs-huzme)"
              filter="url(#cs-yumusak)" style="mix-blend-mode:screen"/>
        <ellipse cx="418" cy="142" rx="30" ry="8" fill="#ffd9a0" opacity="0.8" filter="url(#cs-yumusak)"/>
        <path d="M 382 142 Q 418 114 454 142 Z" fill="url(#cs-abajur)"/>
        <path d="M 382 142 Q 418 114 454 142" fill="none" stroke="#4ade80" stroke-width="1.2" opacity="0.3"/>
        <ellipse cx="418" cy="142" rx="36" ry="5" fill="#0d3520"/>
        <ellipse cx="418" cy="141" rx="26" ry="3" fill="#ffdcaa" opacity="0.88"/>
        <rect x="415" y="142" width="6" height="38" fill="#8a6534"/>
        <rect x="416" y="142" width="2" height="38" fill="#d6a55c" opacity="0.75"/>
        <ellipse cx="418" cy="182" rx="18" ry="5" fill="#6b4d28"/>
        <ellipse cx="418" cy="180" rx="18" ry="5" fill="#8a6534"/>
      </g>

      <!-- Huzmede asılı toz -->
      <g fill="#ffe6bf">
        <circle class="cs-toz-1" cx="400" cy="182" r="1.1" opacity="0"/>
        <circle class="cs-toz-2" cx="434" cy="170" r="0.9" opacity="0"/>
        <circle class="cs-toz-3" cx="416" cy="192" r="1.3" opacity="0"/>
      </g>

      <!-- ═══ SON İŞLEM ═══ -->
      <rect width="480" height="240" fill="url(#cs-vinyet)"/>
      <rect width="480" height="240" filter="url(#cs-grain)" opacity="0.07" style="mix-blend-mode:overlay"/>
    </svg>
  `;
}

// 🚶 2. MOLA SAHNESİ — masadan kalkıp pencerenin önünde volta atan Holmes.
function getSherlockWalkingScene() {
  return `
    <svg viewBox="0 0 480 240" preserveAspectRatio="xMidYMid slice" class="w-full h-40 md:h-44 select-none">
      <defs>
        <linearGradient id="cw-duvar" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#05070d"/>
          <stop offset="60%" stop-color="#0a0f19"/>
          <stop offset="100%" stop-color="#111823"/>
        </linearGradient>
        <linearGradient id="cw-zemin" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#1c1710"/>
          <stop offset="100%" stop-color="#090706"/>
        </linearGradient>
        <linearGradient id="cw-ay" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#1b3a5c"/>
          <stop offset="60%" stop-color="#12283f"/>
          <stop offset="100%" stop-color="#0b1826"/>
        </linearGradient>
        <linearGradient id="cw-huzme" x1="20%" y1="0%" x2="80%" y2="100%">
          <stop offset="0%" stop-color="#93c5fd" stop-opacity="0.26"/>
          <stop offset="100%" stop-color="#60a5fa" stop-opacity="0"/>
        </linearGradient>
        <linearGradient id="cw-palto" x1="0%" y1="0%" x2="100%" y2="60%">
          <stop offset="0%" stop-color="#141b27"/>
          <stop offset="55%" stop-color="#0a0f17"/>
          <stop offset="100%" stop-color="#05080f"/>
        </linearGradient>
        <radialGradient id="cw-ocak" cx="50%" cy="72%" r="55%">
          <stop offset="0%" stop-color="#ff9a3c" stop-opacity="0.7"/>
          <stop offset="55%" stop-color="#c2410c" stop-opacity="0.22"/>
          <stop offset="100%" stop-color="#000" stop-opacity="0"/>
        </radialGradient>
        <filter id="cw-uzak" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="2.4"/>
        </filter>
        <filter id="cw-yumusak" x="-70%" y="-70%" width="240%" height="240%">
          <feGaussianBlur stdDeviation="5"/>
        </filter>
        <filter id="cw-golge" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="7"/>
        </filter>
        <filter id="cw-grain">
          <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="3" seed="23"/>
          <feColorMatrix type="saturate" values="0"/>
        </filter>
        <clipPath id="cw-kafaKirp">
          <path d="M 234 54 C 244 48 258 52 261 63 C 262 69 261 72 259 74
                   L 265 79 L 257 82 C 256 86 258 88 256 90
                   C 252 94 242 93 238 88 C 235 84 234 78 234 72 Z"/>
        </clipPath>
        <radialGradient id="cw-vinyet" cx="50%" cy="55%" r="62%">
          <stop offset="0%" stop-color="#000" stop-opacity="0"/>
          <stop offset="62%" stop-color="#000" stop-opacity="0.14"/>
          <stop offset="100%" stop-color="#000" stop-opacity="0.74"/>
        </radialGradient>
      </defs>

      <style>
        /* Volta: odanın bir ucundan diğerine yürüyüp DÖNÜYOR.
           ⚠️ transform-origin figürün kendi merkezine sabit — yoksa scaleX(-1)
           (0,0) etrafında uygulanır ve figür dönüş karesinde ışınlanır.
           translateX aralığı figürü kadraj içinde tutacak şekilde seçildi
           (yerel merkez x≈244; -146..+120 → ekranda 98..364). */
        @keyframes cwVolta {
          0%   { transform: translateX(-146px) scaleX(1); }
          7%   { transform: translateX(-146px) scaleX(1); }
          45%  { transform: translateX(120px) scaleX(1); }
          50%  { transform: translateX(120px) scaleX(-1); }
          57%  { transform: translateX(120px) scaleX(-1); }
          95%  { transform: translateX(-146px) scaleX(-1); }
          100% { transform: translateX(-146px) scaleX(1); }
        }
        @keyframes cwBacakOn  { 0%,100% { transform: rotate(24deg); } 50% { transform: rotate(-22deg); } }
        @keyframes cwBacakArka{ 0%,100% { transform: rotate(-22deg); } 50% { transform: rotate(24deg); } }
        /* Diz adımın ortasında bükülür; düz çubuk bacak robot gibi duruyordu */
        @keyframes cwDiz      { 0%,100% { transform: rotate(0deg); } 30% { transform: rotate(26deg); } 60% { transform: rotate(4deg); } }
        @keyframes cwDizArka  { 0%,100% { transform: rotate(20deg); } 40% { transform: rotate(2deg); } 75% { transform: rotate(30deg); } }
        @keyframes cwKol      { 0%,100% { transform: rotate(-15deg); } 50% { transform: rotate(16deg); } }
        @keyframes cwZipla    { 0%,50%,100% { transform: translateY(0); } 25%,75% { transform: translateY(-3px); } }
        @keyframes cwEtek     { 0%,100% { transform: rotate(5deg); } 50% { transform: rotate(-6deg); } }
        @keyframes cwBuhar {
          0%   { transform: translate(0,0) scale(0.5); opacity: 0; }
          22%  { opacity: 0.5; }
          100% { transform: translate(10px,-32px) scale(2.2); opacity: 0; }
        }
        /* Ateş sabit yanmaz: iki alev dili farklı ritimde nefes alıyor */
        @keyframes cwAtes1 { 0%,100% { transform: scaleY(1) scaleX(1); opacity: 0.9; } 35% { transform: scaleY(1.16) scaleX(0.92); opacity: 0.7; } 68% { transform: scaleY(0.9) scaleX(1.06); opacity: 1; } }
        @keyframes cwAtes2 { 0%,100% { transform: scaleY(0.94) scaleX(1.04); opacity: 0.8; } 45% { transform: scaleY(1.2) scaleX(0.9); opacity: 1; } 75% { transform: scaleY(1) scaleX(1); opacity: 0.65; } }
        @keyframes cwKor   { 0%,100% { opacity: 0.85; } 40% { opacity: 0.62; } 70% { opacity: 1; } }

        .cw-volta     { animation: cwVolta 16s infinite ease-in-out; transform-origin: 244px 150px; }
        .cw-zipla     { animation: cwZipla 1.1s infinite ease-in-out; }
        .cw-bacak-on  { animation: cwBacakOn 1.1s infinite ease-in-out; transform-origin: 244px 140px; }
        .cw-bacak-arka{ animation: cwBacakArka 1.1s infinite ease-in-out; transform-origin: 244px 140px; }
        .cw-diz-on    { animation: cwDiz 1.1s infinite ease-in-out; transform-origin: 246px 172px; }
        .cw-diz-arka  { animation: cwDizArka 1.1s infinite ease-in-out; transform-origin: 242px 172px; }
        .cw-kol       { animation: cwKol 1.1s infinite ease-in-out; transform-origin: 248px 102px; }
        .cw-etek      { animation: cwEtek 1.1s infinite ease-in-out; transform-origin: 244px 126px; }
        .cw-buhar-1   { animation: cwBuhar 3.2s infinite ease-out; }
        .cw-buhar-2   { animation: cwBuhar 3.2s infinite ease-out 1.1s; }
        .cw-buhar-3   { animation: cwBuhar 3.2s infinite ease-out 2.1s; }
        .cw-ates-1    { animation: cwAtes1 2.3s infinite ease-in-out; transform-origin: 436px 186px; }
        .cw-ates-2    { animation: cwAtes2 1.7s infinite ease-in-out; transform-origin: 436px 186px; }
        .cw-kor       { animation: cwKor 3.4s infinite ease-in-out; }

        @media (prefers-reduced-motion: reduce) {
          .cw-volta, .cw-zipla, .cw-bacak-on, .cw-bacak-arka, .cw-diz-on, .cw-diz-arka,
          .cw-kol, .cw-etek, .cw-buhar-1, .cw-buhar-2, .cw-buhar-3,
          .cw-ates-1, .cw-ates-2, .cw-kor { animation: none; }
        }
      </style>

      <!-- ═══ ARKA PLAN ═══ -->
      <rect width="480" height="240" fill="url(#cw-duvar)"/>
      <g opacity="0.045" fill="#93c5fd">
        <rect x="14" y="0" width="2" height="190"/><rect x="48" y="0" width="2" height="190"/>
        <rect x="82" y="0" width="2" height="190"/><rect x="116" y="0" width="2" height="190"/>
        <rect x="150" y="0" width="2" height="190"/><rect x="184" y="0" width="2" height="190"/>
        <rect x="218" y="0" width="2" height="190"/><rect x="252" y="0" width="2" height="190"/>
        <rect x="286" y="0" width="2" height="190"/><rect x="320" y="0" width="2" height="190"/>
        <rect x="354" y="0" width="2" height="190"/><rect x="388" y="0" width="2" height="190"/>
        <rect x="422" y="0" width="2" height="190"/><rect x="456" y="0" width="2" height="190"/>
      </g>
      <rect x="0" y="188" width="480" height="9" fill="#0d131c"/>
      <rect x="0" y="188" width="480" height="1.6" fill="#2b3546" opacity="0.6"/>

      <!-- ═══ AY IŞIKLI PENCERE — kontra ışık kaynağı ═══ -->
      <g>
        <rect x="150" y="18" width="150" height="150" rx="3" fill="url(#cw-ay)"/>
        <circle cx="188" cy="46" r="20" fill="#dbeafe" opacity="0.4" filter="url(#cw-yumusak)"/>
        <circle cx="188" cy="46" r="8" fill="#e8f2ff" opacity="0.7"/>
        <g fill="#060a12" opacity="0.9" filter="url(#cw-uzak)">
          <rect x="150" y="112" width="42" height="56"/>
          <rect x="196" y="96" width="34" height="72"/>
          <rect x="234" y="120" width="30" height="48"/>
          <rect x="268" y="104" width="32" height="64"/>
          <rect x="206" y="82" width="8" height="16"/>
        </g>
        <g fill="#fbbf24" opacity="0.3">
          <rect x="202" y="106" width="5" height="6"/><rect x="216" y="122" width="5" height="6"/>
          <rect x="276" y="118" width="5" height="6"/><rect x="158" y="128" width="5" height="6"/>
        </g>
        <rect x="222" y="18" width="6" height="150" fill="#080d15"/>
        <rect x="150" y="90" width="150" height="6" fill="#080d15"/>
        <rect x="146" y="14" width="158" height="158" rx="4" fill="none" stroke="#151d29" stroke-width="8"/>
      </g>
      <path d="M 158 196 L 296 196 L 344 240 L 118 240 Z" fill="url(#cw-huzme)"
            filter="url(#cw-yumusak)" style="mix-blend-mode:screen"/>

      <!-- ═══ ŞÖMİNE — sahnenin sıcak kutbu ═══ -->
      <g>
        <rect x="392" y="96" width="88" height="92" rx="3" fill="#0b1016"/>
        <rect x="384" y="88" width="104" height="11" rx="2" fill="#151c26"/>
        <path d="M 406 188 L 406 128 Q 436 112 466 128 L 466 188 Z" fill="#05080d"/>
        <ellipse class="cw-kor" cx="436" cy="168" rx="40" ry="36" fill="url(#cw-ocak)"/>
        <!-- Odunlar -->
        <rect x="416" y="180" width="40" height="6" rx="3" fill="#1c1108"/>
        <rect x="422" y="174" width="30" height="6" rx="3" fill="#241608" transform="rotate(-6 437 177)"/>
        <!-- Alev dilleri: iki ayrı ritimde nefes alan organik biçimler -->
        <path class="cw-ates-1"
              d="M 436 184 C 428 174 430 164 434 154 C 436 160 439 162 441 158
                 C 445 166 446 176 442 184 Z" fill="#ea580c" opacity="0.9"/>
        <path class="cw-ates-2"
              d="M 436 184 C 431 177 432 170 435 163 C 437 168 439 169 440 166
                 C 443 172 443 179 440 184 Z" fill="#fbbf24" opacity="0.85"/>
        <path class="cw-ates-1" d="M 436 184 C 434 180 435 176 437 172 C 439 176 439 181 438 184 Z"
              fill="#fef3c7" opacity="0.8"/>
        <rect x="404" y="184" width="64" height="5" rx="2" fill="#160e06"/>
      </g>
      <ellipse cx="436" cy="210" rx="62" ry="15" fill="#ff9a3c" opacity="0.13" filter="url(#cw-yumusak)"/>

      <!-- ═══ ZEMİN ═══ -->
      <path d="M 0 196 L 480 196 L 480 240 L 0 240 Z" fill="url(#cw-zemin)"/>
      <g stroke="#2a1f14" stroke-width="1" opacity="0.45">
        <line x1="0" y1="209" x2="480" y2="209"/>
        <line x1="0" y1="223" x2="480" y2="223"/>
        <line x1="72" y1="196" x2="56" y2="240"/>
        <line x1="188" y1="196" x2="182" y2="240"/>
        <line x1="304" y1="196" x2="310" y2="240"/>
        <line x1="416" y1="196" x2="430" y2="240"/>
      </g>
      <ellipse cx="240" cy="220" rx="150" ry="18" fill="#3a1f1a" opacity="0.3"/>

      <!-- ═══ YÜRÜYEN FİGÜR ═══ -->
      <g class="cw-volta">
       <!-- Olcek ayri bir sarmalayicida: .cw-volta'nin transform'unu animasyon
            komple eziyor, oraya scale yazilamaz. Ayak hizasindan (y=204)
            buyutuyoruz ki figur zeminden kopmasin. -->
       <g transform="translate(244,204) scale(1.18) translate(-244,-204)">
        <ellipse cx="244" cy="204" rx="32" ry="6.5" fill="#000" opacity="0.5" filter="url(#cw-golge)"/>

        <g class="cw-zipla">
          <!-- ARKA BACAK (önce çizilir → derinlik) -->
          <g class="cw-bacak-arka">
            <path d="M 242 138 L 240 174" stroke="#080c14" stroke-width="14" stroke-linecap="round"/>
            <g class="cw-diz-arka">
              <path d="M 240 172 L 238 200" stroke="#080c14" stroke-width="12" stroke-linecap="round"/>
              <path d="M 231 203 L 250 203" stroke="#04060a" stroke-width="7" stroke-linecap="round"/>
            </g>
          </g>

          <!-- Palto etekleri: gövdenin arkasından savruluyor -->
          <g class="cw-etek">
            <path d="M 226 124 L 219 172 Q 244 181 269 172 L 262 124 Z" fill="#080d14"/>
            <path d="M 262 126 L 269 172 Q 258 177 248 178 L 251 126 Z" fill="#1c2534" opacity="0.85"/>
            <!-- Etegin ust kenarinda kumasin kivrimi -->
            <path d="M 226 130 Q 244 138 262 130" fill="none" stroke="#28344a"
                  stroke-width="1.3" opacity="0.5"/>
            <path d="M 219 172 Q 244 181 269 172" fill="none" stroke="#7fb3e8"
                  stroke-width="1.1" opacity="0.25"/>
          </g>

          <!-- ÖN BACAK -->
          <g class="cw-bacak-on">
            <path d="M 246 138 L 248 174" stroke="#101822" stroke-width="15" stroke-linecap="round"/>
            <g class="cw-diz-on">
              <path d="M 248 172 L 250 200" stroke="#101822" stroke-width="13" stroke-linecap="round"/>
              <!-- On bacagin dis kenari: arka bacaktan ayirmak icin -->
              <path d="M 253 174 L 255 198" stroke="#7fb3e8" stroke-width="1.1"
                    stroke-linecap="round" opacity="0.3"/>
              <path d="M 243 203 L 264 203" stroke="#070a11" stroke-width="8" stroke-linecap="round"/>
            </g>
          </g>

          <!-- GÖVDE -->
          <path d="M 228 102
                   C 228 90 240 84 246 84
                   C 254 84 264 90 264 102
                   L 266 138 L 224 138 Z"
                fill="url(#cw-palto)"/>
          <!-- Ay ışığının sırtta bıraktığı kontra ışık -->
          <path d="M 228 102 C 228 91 237 85 244 84" fill="none" stroke="#7fb3e8"
                stroke-width="1.6" stroke-linecap="round" opacity="0.5"/>
          <path d="M 225 110 L 225 138" fill="none" stroke="#7fb3e8"
                stroke-width="1.3" stroke-linecap="round" opacity="0.28"/>
          <!-- Şömineden gelen sıcak dolgu (sağ kenar) -->
          <path d="M 264 104 L 266 136" fill="none" stroke="#f0a44a"
                stroke-width="1.4" stroke-linecap="round" opacity="0.35"/>

          <!-- Atkı -->
          <path d="M 236 86 Q 246 94 258 86 L 260 94 Q 246 102 234 94 Z" fill="#6d1b1b" opacity="0.9"/>
          <path class="cw-etek" d="M 255 92 L 262 114 L 255 112 L 251 94 Z" fill="#7f1d1d" opacity="0.85"/>

          <!-- BOYUN + KAFA (profil, yürüyüş yönüne bakıyor) -->
          <path d="M 240 74 L 240 86 L 252 86 L 252 72 Z" fill="#0b1018"/>
          <path d="M 234 54
                   C 244 48 258 52 261 63
                   C 262 69 261 72 259 74
                   L 265 79
                   L 257 82
                   C 256 86 258 88 256 90
                   C 252 94 242 93 238 88
                   C 235 84 234 78 234 72 Z"
                fill="#0d131c"/>
          <!-- Kontra isikta yuz: sadece kenar okunuyor, ici tamamen karanlik -->
          <g clip-path="url(#cw-kafaKirp)">
            <path d="M 261 63 C 262 69 261 72 259 74 L 265 79 L 257 82
                     C 256 86 258 88 256 90"
                  fill="none" stroke="#3d5f85" stroke-width="8" stroke-linecap="round" opacity="0.5"/>
            <path d="M 261 63 C 262 69 261 72 259 74 L 265 79 L 257 82
                     C 256 86 258 88 256 90"
                  fill="none" stroke="#6d94bd" stroke-width="3.5" stroke-linecap="round" opacity="0.6"/>
          </g>
          <path d="M 261 63 C 262 69 261 72 259 74 L 265 79 L 257 82
                   C 256 86 258 88 256 90"
                fill="none" stroke="#c5dcf5" stroke-width="1.3" stroke-linecap="round" opacity="0.8"/>
          <path d="M 230 60 C 228 44 244 36 252 39 C 262 43 266 52 264 62
                   C 256 55 242 54 230 60 Z" fill="#161d29"/>
          <path d="M 261 58 C 269 58 275 61 275 64 C 271 66 264 65 259 63 Z" fill="#121924"/>
          <path d="M 234 60 C 226 60 220 63 221 66 C 225 68 231 66 236 64 Z" fill="#101620"/>
          <path d="M 232 56 C 235 44 248 38 254 40" fill="none" stroke="#a8cdf0"
                stroke-width="1.3" stroke-linecap="round" opacity="0.35"/>

          <!-- KOL + KAHVE FİNCANI -->
          <g class="cw-kol">
            <path d="M 248 102 C 239 114 236 126 238 136"
                  fill="none" stroke="#0c121b" stroke-width="13" stroke-linecap="round"/>
            <!-- Kolun ay isigina bakan kenari: onsuz kol fondan ayrilmiyor
                 ve fincan havada duruyormus gibi gorunuyordu -->
            <path d="M 246 104 C 238 115 235 126 236 134"
                  fill="none" stroke="#7fb3e8" stroke-width="1.3" stroke-linecap="round" opacity="0.45"/>
            <circle cx="238" cy="138" r="4.5" fill="#7a5e42"/>
            <!-- Fincan: küçük ve kısık; sahnenin en parlak nesnesi OLMAMALI -->
            <path d="M 231 132 L 245 132 L 243 142 L 233 142 Z" fill="#aab4c2"/>
            <path d="M 239 132 L 245 132 L 243 142 L 239 142 Z" fill="#7c8797" opacity="0.8"/>
            <ellipse cx="238" cy="132" rx="7" ry="2.4" fill="#c3ccd8"/>
            <ellipse cx="238" cy="132" rx="5" ry="1.5" fill="#2e1c10"/>
            <path d="M 245 134 Q 250 136 246 140" fill="none" stroke="#aab4c2" stroke-width="1.6"/>
          </g>
        </g>

        <g filter="url(#cw-yumusak)" opacity="0.4">
          <ellipse class="cw-buhar-1" cx="238" cy="128" rx="3.4" ry="2.6" fill="#e2e8f0"/>
          <ellipse class="cw-buhar-2" cx="240" cy="128" rx="2.8" ry="2.2" fill="#cbd5e1"/>
          <ellipse class="cw-buhar-3" cx="236" cy="128" rx="4" ry="3" fill="#f1f5f9"/>
        </g>
       </g>
      </g>

      <!-- ═══ ÖN PLAN: koltuk silueti — derinliği kapatan koyu kütle ═══ -->
      <g>
        <path d="M -10 240 L -10 208 Q -10 196 6 194 L 40 194 Q 58 194 60 208 L 62 240 Z" fill="#05080d"/>
        <path d="M 62 214 Q 40 202 6 204" fill="none" stroke="#1e2938" stroke-width="1.8" opacity="0.5"/>
        <path d="M 60 208 Q 34 198 -6 200" fill="none" stroke="#0f1621" stroke-width="6" opacity="0.9"/>
      </g>

      <!-- ═══ SON İŞLEM ═══ -->
      <rect width="480" height="240" fill="url(#cw-vinyet)"/>
      <rect width="480" height="240" filter="url(#cw-grain)" opacity="0.07" style="mix-blend-mode:overlay"/>
    </svg>
  `;
}

/* ── SHERLOCK SENİNLE GELİR ───────────────────────────────────────
   Uygulama içi sayfa geçişlerinde (Bugün → Takvim → Parçalayıcı…) widget
   zaten kalıyor: `loadPage` yalnızca `#main-content`i siliyor, widget ise
   `document.body` seviyesinde duruyor. Ölçüldü, 5 sayfada da kalıyor.

   Asıl boşluk şuydu: kullanıcı İŞİ İÇİN başka bir sekmeye/siteye geçtiğinde
   Sherlock arkada kalıyordu — oysa body doubling'in bütün fikri "yanında
   biri olsun". Çözüm Document Picture-in-Picture: widget, her zaman üstte
   duran küçük bir pencereye TAŞINIYOR (kopyalanmıyor), böylece tek bir
   Sherlock var ve durumu bölünmüyor.

   Taşıma üç şeyi kırıyordu; üçü de burada çözülü:

   1. `document.getElementById('sherlock-scene-wrap')` — widget PiP belgesine
      geçince ana belgede yok. Artık her sorgu WIDGET ÜZERİNDEN yapılıyor
      (`bdOge`), yani widget hangi belgede olursa olsun çalışıyor.
   2. `getCompanionWidget` widget'ı ana belgede arıyordu; bulamayınca
      İKİNCİ bir widget üretirdi. Artık referans `BodyDoublingState.widget`
      içinde tutuluyor.
   3. Inline `onclick="showBodyDoubling(...)"` — inline handler öğenin KENDİ
      belgesinin window'unda çözülür, PiP penceresinde o fonksiyonlar yok,
      butonlar sessizce ölürdü. Hepsi `addEventListener`a çevrildi; kapanış
      bu window'da kaldığı için taşımadan etkilenmiyor.

   PiP belgesi CSS'i miras ALMAZ; `stilleriAktar` sayfanın stylesheet'lerini
   kopyalıyor. Çapraz-kaynak (CDN) sayfalar `cssRules`a izin vermez, onlar
   zaten `href` ile `<link>` olarak taşınıyor.
   ──────────────────────────────────────────────────────────────── */

// Yukseklik icerige gore secildi: 340px genislikte sahne 2:1 oraninda 170px,
// ustunde baslik, altinda fisilti satiri. Fazlasi sahneyi gereksiz kirpiyordu.
const PIP_OLCU = { width: 340, height: 300 };

/** Widget hangi belgede yaşıyorsa oradaki öğeyi bulur. */
function bdOge(id) {
  const w = BodyDoublingState.widget;
  return w ? w.querySelector('#' + id) : null;
}

function sherlockAyriPencereDestekli() {
  return typeof window !== 'undefined' && 'documentPictureInPicture' in window;
}

function getCompanionWidget() {
  let widget = BodyDoublingState.widget;
  // isConnected: PiP'e taşınmış widget da bağlıdır (PiP belgesine).
  if (widget && widget.isConnected) return widget;
  widget = document.getElementById('body-doubling-widget');
  if (!widget) {
    widget = document.createElement('div');
    widget.id = 'body-doubling-widget';
    widget.className = 'fixed bottom-5 right-5 z-40 transition-all duration-500 select-none';
    widget.innerHTML = `
      <div id="bd-companion-card" class="glass-card p-3 md:p-4 bg-slate-900/95 shadow-2xl border-2 border-indigo-500/40 rounded-3xl backdrop-blur-2xl w-80 md:w-96 animate-slide-in relative group transition-all duration-500 overflow-hidden">

        <div class="absolute top-3 right-3 z-10 flex gap-1.5">
          <button type="button" id="bd-pip-btn"
                  class="w-7 h-7 bg-slate-800 hover:bg-indigo-600 text-slate-300 hover:text-white rounded-full text-xs font-bold flex items-center justify-center transition shadow-lg"
                  title="Yanımda gelsin — ayrı pencerede, hep üstte">⧉</button>
          <button type="button" id="bd-kapat-btn"
                  class="w-7 h-7 bg-slate-800 hover:bg-rose-600 text-slate-300 hover:text-white rounded-full text-xs font-bold flex items-center justify-center transition shadow-lg"
                  title="Gizle">✕</button>
        </div>

        <div id="bd-baslik" class="flex items-center flex-nowrap gap-2 mb-2 pr-20">
          <span id="bd-ad" class="text-sm font-black text-white whitespace-nowrap shrink-0">🕵️‍♂️ Sherlock</span>
          <span id="sherlock-badge" class="text-[10px] px-2.5 py-0.5 bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 rounded-full font-bold flex items-center gap-1.5 min-w-0">
            <span class="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-ping shrink-0"></span>
            <span id="sherlock-status-text" class="truncate">Masasında Davayı İnceliyor</span>
          </span>
          <!-- Ayrı pencerede sayaç görünmez olurdu: kalan süre buraya düşüyor -->
          <span id="bd-kalan" hidden
                class="text-[11px] font-black tabular-nums text-indigo-200 bg-slate-800/80 px-2 py-0.5 rounded-full"></span>
        </div>

        <div id="sherlock-scene-wrap" class="rounded-2xl overflow-hidden border border-slate-700/60 shadow-inner bg-slate-950 min-h-[160px]">
          ${getSherlockStudyScene()}
        </div>

        <div class="mt-2.5 p-2 rounded-xl bg-slate-800/70 border border-slate-700/50 flex items-center justify-between gap-2">
          <p id="companion-speech" class="text-xs text-slate-300 italic leading-snug truncate flex-1">
            "Vaka dosyasındaki ipuçlarını inceliyorum, sen de odağını koru dostum 🔍"
          </p>
          <div class="flex gap-1 shrink-0">
            <button type="button" id="bd-sahne-calis" title="Masada Çalış"
                    class="px-2 py-1 bg-slate-700 hover:bg-indigo-600 text-white rounded-lg text-[10px] font-bold transition">📖</button>
            <button type="button" id="bd-sahne-mola" title="Ayağa Kalk & Yürü"
                    class="px-2 py-1 bg-slate-700 hover:bg-emerald-600 text-white rounded-lg text-[10px] font-bold transition">🚶‍♂️</button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(widget);
  }
  BodyDoublingState.widget = widget;

  // ⚠️ Inline onclick DEĞİL: PiP belgesine taşınınca inline handler o
  // pencerenin window'unda aranır ve bulunamaz. Kapanış burada kalıyor.
  // Bayrak: bu fonksiyon widget varken de çağrılabiliyor; handler birikmesin.
  if (widget.dataset.bdBagli === '1') { pipButonunuGuncelle(); return widget; }
  widget.dataset.bdBagli = '1';
  bdOge('bd-kapat-btn')?.addEventListener('click', () => toggleBodyDoublingVisibility(false));
  bdOge('bd-sahne-calis')?.addEventListener('click', () => showBodyDoubling('working'));
  bdOge('bd-sahne-mola')?.addEventListener('click', () => showBodyDoubling('break'));
  bdOge('bd-pip-btn')?.addEventListener('click', () => {
    if (BodyDoublingState.pipPenceresi) sherlockGeriDon();
    else sherlockYanimaGel();
  });
  pipButonunuGuncelle();

  return widget;
}

/** PiP belgesi stil miras almaz; sayfanın stylesheet'lerini oraya taşı. */
function stilleriAktar(pip) {
  for (const ss of Array.from(document.styleSheets)) {
    try {
      if (ss.href) {
        const link = pip.document.createElement('link');
        link.rel = 'stylesheet';
        link.href = ss.href;
        pip.document.head.appendChild(link);
      } else {
        const st = pip.document.createElement('style');
        st.textContent = Array.from(ss.cssRules).map(r => r.cssText).join('\n');
        pip.document.head.appendChild(st);
      }
    } catch (e) {
      // Çapraz-kaynak stylesheet cssRules'a izin vermez; href'i olanlar
      // zaten yukarıdaki dalda <link> olarak taşındı.
    }
  }
  const ek = pip.document.createElement('style');
  ek.textContent = `
    html, body { margin: 0; padding: 0; background: #0b1120; overflow: hidden; height: 100%; }
    #body-doubling-widget { display: block; height: 100%; }
    #bd-companion-card {
      width: 100% !important; height: 100%; border-radius: 0 !important;
      border-left: 0 !important; border-right: 0 !important; border-bottom: 0 !important;
      display: flex; flex-direction: column;
    }
    /* Sahne kutusu esnerse (flex:1) 2:1 viewBox slice ile ustten/alttan
       kirpilir ve masa/tavan kadraj disinda kalir. Orani sabitliyoruz;
       artan bosluk fisilti satirina gidiyor. */
    #sherlock-scene-wrap { flex: 0 0 auto; aspect-ratio: 2 / 1; min-height: 0; }
    #sherlock-scene-wrap svg { height: 100%; width: 100%; display: block; }
    #bd-companion-card > div:last-child { margin-top: auto; }
    /* 340px'lik pencerede baslik satiri sariyor, kalan sure butonlarin
       altina dusuyordu: tek satira zorla, rozeti gizle (durum zaten
       sahnede ve fisiltida okunuyor), ada biraz daha az yer ayir. */
    #bd-baslik { flex-wrap: nowrap; white-space: nowrap; padding-right: 5rem; }
    #bd-baslik #sherlock-badge { display: none; }
    #bd-ad { font-size: 12px; }
    #bd-kalan { margin-left: auto; }
  `;
  pip.document.head.appendChild(ek);
}

/** Butona basıldı ama pencere açılmadıysa kullanıcı sebebini bilmeli. */
function bdBilgiVer(mesaj) {
  if (typeof showToast === 'function') showToast(mesaj, 'info');
  else console.warn('[Sherlock]', mesaj);
}

async function sherlockYanimaGel() {
  if (!sherlockAyriPencereDestekli()) {
    bdBilgiVer('Ayrı pencere bu tarayıcıda desteklenmiyor (Chrome 116+ gerekiyor).');
    return false;
  }
  if (BodyDoublingState.pipPenceresi) { BodyDoublingState.pipPenceresi.focus(); return true; }

  const widget = getCompanionWidget();
  let pip;
  try {
    pip = await documentPictureInPicture.requestWindow(PIP_OLCU);
  } catch (e) {
    // ⚠️ Sessizce vazgeçme: buton hiçbir şey yapmıyormuş gibi görünüyordu.
    // En sık sebep NotAllowedError — tarayıcı bunu yalnızca gerçek bir
    // kullanıcı tıklamasında (user activation) veriyor.
    bdBilgiVer(e && e.name === 'NotAllowedError'
      ? 'Sherlock’u ayrı pencereye almak için butona doğrudan tıklaman gerekiyor.'
      : 'Ayrı pencere açılamadı: ' + ((e && e.message) || 'bilinmeyen hata'));
    return false;
  }
  BodyDoublingState.pipPenceresi = pip;
  stilleriAktar(pip);

  // Widget'ın ana belgedeki yerini işaretle ki geri dönünce aynı yere otursun.
  const yer = document.createElement('div');
  yer.id = 'bd-yer-tutucu';
  yer.hidden = true;
  widget.parentNode.insertBefore(yer, widget);

  // PiP penceresinde sağ-alt köşeye sabitlemek anlamsız: kart pencereyi kaplıyor.
  widget.classList.remove('fixed', 'bottom-5', 'right-5', 'z-40');
  pip.document.body.appendChild(widget);

  pip.addEventListener('pagehide', () => sherlockGeriDon(), { once: true });
  kalanSureyiIzle(true);
  pipButonunuGuncelle();
  return true;
}

function sherlockGeriDon() {
  const widget = BodyDoublingState.widget;
  const yer = document.getElementById('bd-yer-tutucu');
  if (widget) {
    widget.classList.add('fixed', 'bottom-5', 'right-5', 'z-40');
    if (yer && yer.parentNode) yer.parentNode.insertBefore(widget, yer);
    else document.body.appendChild(widget);
  }
  if (yer) yer.remove();

  const pencere = BodyDoublingState.pipPenceresi;
  BodyDoublingState.pipPenceresi = null;
  if (pencere && !pencere.closed) pencere.close();

  kalanSureyiIzle(false);
  pipButonunuGuncelle();
}

function pipButonunuGuncelle() {
  const btn = bdOge('bd-pip-btn');
  if (!btn) return;
  if (!sherlockAyriPencereDestekli()) { btn.hidden = true; return; }
  const acik = !!BodyDoublingState.pipPenceresi;
  btn.textContent = acik ? '⇤' : '⧉';
  btn.title = acik ? 'Uygulamaya geri al' : 'Yanımda gelsin — ayrı pencerede, hep üstte';
}

/** sn → "MM:SS" */
function bdSureMetni(saniye) {
  const s = Math.max(0, Math.floor(saniye || 0));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

/** Ayrı pencerede odak sayacı görünmez kalırdı; rozetin yanına düşürüyoruz. */
function kalanSureyiIzle(baslat) {
  if (BodyDoublingState.sureTimer) {
    clearInterval(BodyDoublingState.sureTimer);
    BodyDoublingState.sureTimer = null;
  }
  const kutu = bdOge('bd-kalan');
  if (!baslat) { if (kutu) kutu.hidden = true; return; }
  if (!kutu) return;

  const yaz = () => {
    if (typeof TaskTimerState === 'undefined' || !TaskTimerState.taskId) {
      kutu.hidden = true;
      return;
    }
    kutu.hidden = false;
    kutu.textContent = bdSureMetni(TaskTimerState.remainingSeconds);
  };
  yaz();
  BodyDoublingState.sureTimer = setInterval(yaz, 1000);
}

function showBodyDoubling(status = 'working') {
  BodyDoublingState.isEnabled = true;
  BodyDoublingState.status = status;
  const widget = getCompanionWidget();
  widget.classList.remove('hidden');

  const sceneWrap = bdOge('sherlock-scene-wrap');
  const speech = bdOge('companion-speech');
  const badge = bdOge('sherlock-badge');
  const statusText = bdOge('sherlock-status-text');
  const card = bdOge('bd-companion-card');

  if (status === 'working') {
    if (sceneWrap) sceneWrap.innerHTML = getSherlockStudyScene();
    if (statusText) statusText.textContent = "Masasında Davayı İnceliyor";
    if (badge) {
      badge.className = "text-[10px] px-2.5 py-0.5 bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 rounded-full font-bold flex items-center gap-1.5";
    }
    if (speech) speech.textContent = '"Vaka dosyasındaki ipuçlarını inceliyorum, sen de odağını koru dostum 🔍"';
    if (card) card.style.borderColor = 'rgba(99, 102, 241, 0.5)';
    startCompanionSpeechCycle();
  } else if (status === 'break') {
    // ☕ MOLA: Sherlock masadan kalkıp odada kahvesiyle volta atar.
    if (sceneWrap) sceneWrap.innerHTML = getSherlockWalkingScene();
    if (statusText) statusText.textContent = "Ayağa Kalktı & Kahve Molası ☕";
    if (badge) {
      badge.className = "text-[10px] px-2.5 py-0.5 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-full font-bold flex items-center gap-1.5";
    }
    if (speech) speech.textContent = '"Harika odaklandık! Masadan kalktım, şimdi 5 dakika dinlenme zamanı ☕"';
    if (card) card.style.borderColor = 'rgba(16, 185, 129, 0.7)';
    stopCompanionSpeechCycle();
  }
}

function hideBodyDoubling() {
  // Sayaç durunca ayrı pencereyi de kapat: içi boş bir Sherlock penceresinin
  // ekranda asılı kalması kullanıcıyı rahatsız eder.
  if (BodyDoublingState.pipPenceresi) sherlockGeriDon();
  const widget = BodyDoublingState.widget || document.getElementById('body-doubling-widget');
  if (widget) widget.classList.add('hidden');
  stopCompanionSpeechCycle();
  BodyDoublingState.status = 'idle';
}

function toggleBodyDoublingVisibility(show) {
  if (show === undefined) show = !BodyDoublingState.isEnabled;
  BodyDoublingState.isEnabled = show;
  if (!show) hideBodyDoubling();
  else showBodyDoubling(BodyDoublingState.status || 'working');
}

function startCompanionSpeechCycle() {
  stopCompanionSpeechCycle();
  BodyDoublingState.bubbleTimer = setInterval(() => {
    const speech = bdOge('companion-speech');
    if (speech && BodyDoublingState.status === 'working') {
      const q = SHERLOCK_WORKING_QUOTES[Math.floor(Math.random() * SHERLOCK_WORKING_QUOTES.length)];
      speech.textContent = `"${q}"`;
    }
  }, 200000);
}

function stopCompanionSpeechCycle() {
  if (BodyDoublingState.bubbleTimer) {
    clearInterval(BodyDoublingState.bubbleTimer);
    BodyDoublingState.bubbleTimer = null;
  }
}

// Global window bindings
if (typeof window !== 'undefined') {
  window.showBodyDoubling = showBodyDoubling;
  window.hideBodyDoubling = hideBodyDoubling;
  window.toggleBodyDoublingVisibility = toggleBodyDoublingVisibility;
  window.getCompanionWidget = getCompanionWidget;
  window.sherlockYanimaGel = sherlockYanimaGel;
  window.sherlockGeriDon = sherlockGeriDon;
  window.sherlockAyriPencereDestekli = sherlockAyriPencereDestekli;
}

// Node.js test
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    BodyDoublingState,
    SHERLOCK_WORKING_QUOTES,
    showBodyDoubling,
    hideBodyDoubling,
    toggleBodyDoublingVisibility,
    sherlockAyriPencereDestekli,
    bdSureMetni
  };
}