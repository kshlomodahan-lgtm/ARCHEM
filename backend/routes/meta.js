const express    = require('express');
const router     = express.Router();
const { sql, getPool } = require('../db');
const requireAuth = require('../middleware/auth');

// GET /api/meta/countries
router.get('/countries', requireAuth, async (req, res) => {
  try {
    const pool = await getPool();
    const r = await pool.request().query(`
      SELECT CountryID, NameHE, NameEN, DialCode, CountryCode
      FROM tblCountries
      ORDER BY NameHE
    `);
    res.json({ success: true, data: r.recordset });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// GET /api/meta/contact-method-types
router.get('/contact-method-types', requireAuth, async (req, res) => {
  try {
    const pool = await getPool();
    const r = await pool.request().query(`
      SELECT MethodTypeID, NameHE, NameEN, Category, ValueFormat, Icon, DefaultOrder
      FROM tblContactMethodTypes
      ORDER BY DefaultOrder
    `);
    res.json({ success: true, data: r.recordset });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// GET /api/meta/cities/:countryId
router.get('/cities/:countryId', requireAuth, async (req, res) => {
  try {
    const pool = await getPool();
    const r = await pool.request()
      .input('CountryID', sql.Int, parseInt(req.params.countryId))
      .query(`
        SELECT CityID, NameHE, NameEN, PostalCode
        FROM tblCities
        WHERE CountryID = @CountryID AND IsActive = 1
        ORDER BY NameHE
      `);
    res.json({ success: true, data: r.recordset });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// GET /api/meta/geocode?q=address&city=city&country=country  (Nominatim — fallback to city)
router.get('/geocode', requireAuth, async (req, res) => {
  try {
    const q       = (req.query.q       || '').trim();
    const city    = (req.query.city    || '').trim();
    const country = (req.query.country || '').trim();
    if (!q) return res.json({ success: true, data: null });

    const nominatim = async (query) => {
      const url  = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1&addressdetails=0`;
      const resp = await fetch(url, { headers: { 'User-Agent': 'ARCHEM/1.0 (commission-management)' } });
      const data = await resp.json();
      return data.length ? data[0] : null;
    };

    // Try 1: full address
    let hit = await nominatim(q);

    // Try 2: city + country only (if full address failed and we have those parts)
    if (!hit && (city || country)) {
      const fallback = [city, country].filter(Boolean).join(', ');
      hit = await nominatim(fallback);
    }

    if (!hit) return res.json({ success: true, data: null, message: 'לא נמצא' });

    res.json({
      success: true,
      data: {
        lat:     parseFloat(hit.lat),
        lon:     parseFloat(hit.lon),
        display: hit.display_name,
        approximate: !!(city || country) && q !== [city, country].filter(Boolean).join(', '),
      },
    });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

module.exports = router;
