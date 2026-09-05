/* ══════════════════════════════════════════════════════════════
   FocusAid — 🔔 Web Bildirimleri Motoru (Web Notification API)
   Sekme arka plandayken seans ve mola bitişlerini kaçırmamayı sağlar.
   ══════════════════════════════════════════════════════════════ */

const NotificationManager = {
  isSupported: typeof window !== 'undefined' && 'Notification' in window,

  async requestPermission() {
    if (!this.isSupported) return 'unsupported';
    if (Notification.permission === 'granted') return 'granted';
    if (Notification.permission !== 'denied') {
      const perm = await Notification.requestPermission();
      return perm;
    }
    return Notification.permission;
  },

  send(title, options = {}) {
    if (!this.isSupported || Notification.permission !== 'granted') return null;
    try {
      const defaultIcon = 'dehb.png';
      return new Notification(title, {
        icon: options.icon || defaultIcon,
        badge: options.badge || defaultIcon,
        body: options.body || '',
        silent: options.silent || false,
        tag: options.tag || 'focusaid-notification'
      });
    } catch (e) {
      return null;
    }
  },

  notifySessionComplete(taskName) {
    return this.send('🎯 Odak Seansı Tamamlandı!', {
      body: taskName ? `"${taskName}" için seans bitti. Şimdi 5 dakikalık molayı hak ettin ☕` : '25 dakikalık odak seansını başarıyla tamamladın ☕'
    });
  },

  notifyBreakComplete() {
    return this.send('⚡ Mola Bitti!', {
      body: 'Zihnin tazelendi. Şimdi yeni seansa başlamaya hazır mısın? 🚀'
    });
  }
};

// Node.js test
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    NotificationManager
  };
}
