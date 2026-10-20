"""Hallazgos de la revisión en el diseño: velo mínimo calculado en el servidor (RA-03) y
cambios de diseño simultáneos que no se pisan (ni borran la sinopsis del Maquetador)."""

from __future__ import annotations

import asyncio
import io

import pytest
from PIL import Image

from app.agents import maquetador
from app.cover_image import bright_color, contrast_with_veil, min_veil_for

from .conftest import IDEA_FINANZAS, wait_status

# Velos calculados con `minVeilFor` de frontend/src/lib/cover-image.ts (Node), copiado tal cual.
FRONTEND_CASES = [
    ((255, 255, 255), "#2F6B58", 0.87),
    ((255, 255, 255), "#757575", 1),
    ((127.5, 255, 127.5), "#3B4A9E", 0.74),
    ((127.5, 255, 127.5), "#595959", 0.79),
    ((200, 180, 90), "#9A6A12", 0.97),
    ((30, 30, 30), "#1E5E73", 0),
    ((30, 30, 30), "#000", 0),
    ((240.25, 10.5, 99.75), "#8C2F45", 0.11),
    ((128, 128, 128), "#2F6B58", 0.31),
    ((128, 128, 128), "#757575", 0.96),
    ((250, 250, 245), "#3B4A9E", 0.78),
    ((250, 250, 245), "#595959", 0.83),
]


def png(size: tuple[int, int], color, mode: str = "RGB") -> bytes:
    out = io.BytesIO()
    Image.new(mode, size, color).save(out, format="PNG")
    return out.getvalue()


async def _ebook(client, auth) -> str:
    res = await client.post("/api/ebooks", json={"prompt": IDEA_FINANZAS, "desiredChapters": 5, "exercisePref": "auto", "author": "Ana"}, headers=auth)
    assert res.status_code == 201
    return res.json()["id"]


async def _upload(client, auth, eid, data: bytes) -> str:
    res = await client.post(f"/api/ebooks/{eid}/cover-image", files={"file": ("portada.png", data, "image/png")}, headers=auth)
    assert res.status_code == 201, res.text
    return res.json()["url"]


# ---------- Hallazgo 6: el velo mínimo lo decide el servidor ----------


@pytest.mark.parametrize(("bright", "cloth", "expected"), FRONTEND_CASES)
def test_velo_minimo_igual_que_el_frontend(bright, cloth, expected):
    veil = min_veil_for(bright, cloth)
    assert veil == expected
    if 0 < veil < 1:
        assert contrast_with_veil(bright, cloth, veil) >= 4.5


def test_color_de_las_zonas_claras():
    assert bright_color(png((120, 80), (200, 100, 50))) == (200, 100, 50)
    # Mitad negra y mitad blanca: el 5 % más claro es blanco.
    image = Image.new("RGB", (200, 100), (0, 0, 0))
    image.paste((255, 255, 255), (100, 0, 200, 100))
    out = io.BytesIO()
    image.save(out, format="JPEG", quality=95)
    assert all(v > 250 for v in bright_color(out.getvalue()))
    # Lo transparente cuenta como blanco (el peor caso para el texto blanco).
    assert bright_color(png((10, 10), (0, 0, 0, 0), "RGBA")) == (255, 255, 255)


async def test_el_servidor_calcula_el_velo_minimo_y_lo_sube_en_silencio(client, auth, services):
    eid = await _ebook(client, auth)
    url = await _upload(client, auth, eid, png((64, 96), (255, 255, 255)))

    res = await client.put(f"/api/ebooks/{eid}/design", json={"clothColor": "#000000"}, headers=auth)
    assert res.status_code == 200
    # El cliente dice que no hace falta velo: el servidor no le hace caso y sube el velo hasta el mínimo.
    image = {"src": url, "placement": "fondo", "veil": 0, "minVeil": 0, "focusY": 50, "alt": ""}
    res = await client.put(f"/api/ebooks/{eid}/design", json={"coverImage": image}, headers=auth)
    assert res.status_code == 200
    cover = res.json()["design"]["coverImage"]
    assert cover["minVeil"] == 0.54 and cover["veil"] == 0.54

    # Una tela más clara necesita más velo: se recalcula y se sube sin que lo pida el cliente.
    res = await client.put(f"/api/ebooks/{eid}/design", json={"clothColor": "#2F6B58"}, headers=auth)
    cover = res.json()["design"]["coverImage"]
    assert cover["minVeil"] == 0.87 and cover["veil"] == 0.87

    # Con un velo de sobra se respeta; uno corto, aunque venga con su propio minVeil, se corrige.
    res = await client.put(f"/api/ebooks/{eid}/design", json={"coverImage": {"veil": 0.95}}, headers=auth)
    assert res.json()["design"]["coverImage"]["veil"] == 0.95
    res = await client.put(f"/api/ebooks/{eid}/design", json={"coverImage": {"veil": 0.1, "minVeil": 0}}, headers=auth)
    cover = res.json()["design"]["coverImage"]
    assert res.status_code == 200 and cover["veil"] == 0.87 and cover["minVeil"] == 0.87
    assert services.store.get(eid).design.cover_image.veil == 0.87
    # El color de las zonas claras se calculó al subirla y se guarda con la imagen.
    meta = await services.store.get_asset_meta(url.rsplit("/", 1)[1])
    assert meta["bright"] == [255.0, 255.0, 255.0]
    await wait_status(services, eid, "indice_pendiente")


async def test_imagen_sin_color_guardado_se_calcula_al_usarla(client, auth, services):
    """Imágenes subidas antes de este cálculo: el color se obtiene la primera vez que se usan."""
    eid = await _ebook(client, auth)
    url = await _upload(client, auth, eid, png((48, 48), (255, 255, 255)))
    asset_id = url.rsplit("/", 1)[1]
    await services.store.db.execute("UPDATE assets SET bright = NULL WHERE id = ?", (asset_id,))
    await services.store.db.commit()
    res = await client.put(f"/api/ebooks/{eid}/design", json={"coverImage": {"src": url, "veil": 0}}, headers=auth)
    assert res.json()["design"]["coverImage"]["minVeil"] == min_veil_for((255, 255, 255), services.store.get(eid).design.cloth_color)
    assert (await services.store.get_asset_meta(asset_id))["bright"] == [255.0, 255.0, 255.0]
    await wait_status(services, eid, "indice_pendiente")


async def test_una_imagen_que_no_se_puede_abrir_se_rechaza(client, auth, services):
    eid = await _ebook(client, auth)
    broken = png((8, 8), (10, 10, 10))[:40]  # cabecera PNG válida, datos cortados
    res = await client.post(f"/api/ebooks/{eid}/cover-image", files={"file": ("rota.png", broken, "image/png")}, headers=auth)
    assert res.status_code == 415 and res.json()["detail"]["code"] == "formato"
    await wait_status(services, eid, "indice_pendiente")


# ---------- Hallazgo 4: cambios de diseño simultáneos ----------


async def test_cambios_de_diseno_simultaneos_no_se_pierden(client, auth, services, monkeypatch):
    eid = await _ebook(client, auth)
    url = await _upload(client, auth, eid, png((48, 48), (255, 255, 255)))
    res = await client.put(f"/api/ebooks/{eid}/design", json={"coverImage": {"src": url, "veil": 0.9, "focusY": 50}}, headers=auth)
    assert res.status_code == 200

    # Consultar la imagen tarda un poco: los dos cambios se cruzan.
    for name in ("get_asset_meta", "get_asset"):
        original = getattr(services.store, name, None)
        if original is None:
            continue

        async def slow(asset_id, _original=original):
            await asyncio.sleep(0.05)
            return await _original(asset_id)

        monkeypatch.setattr(services.store, name, slow)

    a = client.put(f"/api/ebooks/{eid}/design", json={"coverImage": {"focusY": 20}}, headers=auth)
    b = client.put(f"/api/ebooks/{eid}/design", json={"clothColor": "#123456", "coverTemplate": "marco"}, headers=auth)
    ra, rb = await asyncio.gather(a, b)
    assert ra.status_code == 200 and rb.status_code == 200
    design = services.store.get(eid).design
    assert design.cover_image.focus_y == 20
    assert design.cloth_color == "#123456" and design.cover_template == "marco"
    await wait_status(services, eid, "indice_pendiente")


async def test_put_design_no_borra_la_sinopsis_escrita_mientras_tanto(client, auth, services, monkeypatch):
    eid = await _ebook(client, auth)
    url = await _upload(client, auth, eid, png((48, 48), (255, 255, 255)))
    await client.put(f"/api/ebooks/{eid}/design", json={"coverImage": {"src": url, "veil": 0.9}}, headers=auth)

    # Mientras el PUT consulta la imagen, el Maquetador guarda la sinopsis.
    for name in ("get_asset_meta", "get_asset"):
        original = getattr(services.store, name, None)
        if original is None:
            continue

        async def writes_blurb(asset_id, _original=original):
            services.store.update(eid, lambda e: setattr(e.design.back_cover, "blurb", "Sinopsis del Maquetador."))
            return await _original(asset_id)

        monkeypatch.setattr(services.store, name, writes_blurb)

    res = await client.put(f"/api/ebooks/{eid}/design", json={"coverImage": {"focusY": 30}}, headers=auth)
    assert res.status_code == 200
    design = services.store.get(eid).design
    assert design.back_cover.blurb == "Sinopsis del Maquetador." and design.cover_image.focus_y == 30
    await wait_status(services, eid, "indice_pendiente")


async def test_el_maquetador_respeta_la_sinopsis_escrita_mientras_trabaja(client, auth, services, monkeypatch):
    res = await client.post("/api/ebooks", json={"prompt": IDEA_FINANZAS, "desiredChapters": 5, "exercisePref": "auto", "author": "Ana"}, headers=auth)
    eid = res.json()["id"]
    await wait_status(services, eid, "indice_pendiente")
    await client.post(f"/api/ebooks/{eid}/outline/approve", headers=auth)
    await wait_status(services, eid, "cap1_pendiente")

    async def write_back_cover(llm, ebook, **kwargs):
        # La persona escribe su sinopsis mientras el Maquetador prepara la suya.
        services.store.update(eid, lambda e: setattr(e.design.back_cover, "blurb", "Mi propia sinopsis."))
        return "Sinopsis del Maquetador."

    monkeypatch.setattr(maquetador, "write_back_cover", write_back_cover)
    await client.post(f"/api/ebooks/{eid}/chapters/1/approve", headers=auth)
    await wait_status(services, eid, "listo", timeout=60)
    assert services.store.get(eid).design.back_cover.blurb == "Mi propia sinopsis."
