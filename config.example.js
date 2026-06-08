// Bu dosyayı "config.js" olarak kopyalayıp kendi değerlerinizi girin.
// Supabase: https://supabase.com/dashboard → Project Settings → API
// Google:   https://console.cloud.google.com → API Credentials
const FOCUSAID_CONFIG = {
    SUPABASE_URL:      'https://PROJE_ID.supabase.co',
    SUPABASE_ANON_KEY: 'SUPABASE_ANON_KEY_BURAYA',
    GOOGLE_API_KEY:    'GOOGLE_API_KEY_BURAYA',
    GOOGLE_CLIENT_ID:  'CLIENT_ID.apps.googleusercontent.com',
    DISCOVERY_DOC:     'https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest',
    SCOPES:            'https://www.googleapis.com/auth/calendar.events',
    N8N_WEBHOOK:       'http://localhost:5678/webhook-test/focusaid-processor',
    TIMEZONE:          'Europe/Istanbul'
};
