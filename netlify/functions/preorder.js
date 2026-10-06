"use strict";

const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxxUZN8DblNJvlb2PJyNM5m43JO8um9D21sDKRSneW92ATdSI9NPjSsJ04Lz8hosEWAyg/exec";

exports.handler = async function (event) {
  if (event.httpMethod !== "GET") {
    return jsonResponse(405, { ok: false, message: "Metode tidak diizinkan." });
  }

  try {
    const response = await fetch(APPS_SCRIPT_URL + "?action=preorder&v=" + Date.now(), {
      method: "GET",
      redirect: "follow",
      headers: { Accept: "application/json" }
    });
    if (!response.ok) throw new Error("Apps Script HTTP " + response.status);

    const data = await response.json();
    if (!data || data.ok !== true || !data.preorder) {
      throw new Error(data && data.message ? data.message : "Respons preorder tidak valid.");
    }
    return jsonResponse(200, data);
  } catch (error) {
    return jsonResponse(502, {
      ok: false,
      message: error && error.message ? error.message : "Apps Script tidak dapat dihubungi."
    });
  }
};

function jsonResponse(statusCode, data) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store, max-age=0"
    },
    body: JSON.stringify(data)
  };
}
