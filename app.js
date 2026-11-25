(() => {
  'use strict';

  
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const params = new URLSearchParams(location.search);
  const FAV = 'avynera_favs', USR = 'avynera_usuario', RES = 'avynera_reservas';

  const leer = (k, def) => { try { return JSON.parse(localStorage.getItem(k)) ?? def; } catch (e) { return def; } };
  const guardar = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* sin almacenamiento */ } };
  const norm = s => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const cop = n => '$' + n.toLocaleString('es-CO') + ' COP';
  const FOTO = (archivo, ancho) => 'https://commons.wikimedia.org/wiki/Special:FilePath/' + encodeURIComponent(archivo) + '?width=' + ancho;
  const PAGINA_FOTO = archivo => 'https://commons.wikimedia.org/wiki/File:' + encodeURIComponent(archivo);
  
  const fondo = (d, ancho) => `url('${FOTO(d.fotos[0], ancho)}'), url('img/ciudades/${d.slug}.svg')`;
  const fmtFecha = f => new Date(f + 'T00:00:00').toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' });

  let temporizador;
  function aviso(msg) {
    let t = $('.toast');
    if (!t) { t = document.createElement('div'); t.className = 'toast'; t.setAttribute('role', 'status'); document.body.appendChild(t); }
    t.textContent = msg; t.hidden = false;
    clearTimeout(temporizador);
    temporizador = setTimeout(() => { t.hidden = true; }, 2500);
  }

  
  function initNav() {
    const u = leer(USR, null), a = $('#nav-sesion');
    if (u && a) { a.textContent = '👤 ' + u.nombre.split(' ')[0]; a.href = 'perfil.html'; }
  }

  
  function pintarFavs() {
    const f = leer(FAV, []);
    $$('[data-fav]').forEach(el => {
      const on = f.includes(+el.dataset.fav);
      el.classList.toggle('activo', on);
      el.setAttribute('aria-pressed', on);
      el.textContent = el.classList.contains('fav') ? (on ? '♥' : '♡') : (on ? '♥ En favoritos' : '♡ Agregar a favoritos');
    });
  }

  document.addEventListener('click', e => {
    const b = e.target.closest('[data-fav]');
    if (b) {
      const id = +b.dataset.fav;
      const ya = leer(FAV, []).includes(id);
      guardar(FAV, ya ? leer(FAV, []).filter(x => x !== id) : [...leer(FAV, []), id]);
      pintarFavs();
      aviso(ya ? 'Quitado de favoritos' : 'Agregado a favoritos');
      document.dispatchEvent(new Event('favs'));
    }
    if (e.target.closest('[data-pronto]')) aviso('Disponible próximamente');
  });

  const tarjeta = d => `
    <article class="tarjeta">
      <div class="img ${d.clase}" style="background-image:${fondo(d, 500)}"><button class="fav" type="button" data-fav="${d.id}" aria-label="Favorito"></button></div>
      <div class="cuerpo">
        <h3>${d.nombre}</h3>
        <span class="datos">${d.pais}</span>
        <span class="estrellas"><b>★</b> ${d.rating} (${d.resenas.toLocaleString('es-CO')})</span>
        <a class="btn" href="detalle.html?id=${d.id}">Ver destino</a>
      </div>
    </article>`;

  function initIndex() {
    const top = [...DESTINOS].sort((a, b) => b.rating - a.rating || b.resenas - a.resenas).slice(0, 4);
    $('#populares').innerHTML = top.map(tarjeta).join('');
    pintarFavs();
  }

  function initDestinos() {
    const q = $('#q'), tipo = $('#tipo');
    q.value = params.get('q') || '';

    const render = () => {
      const texto = norm(q.value.trim());
      const chk = $$('input[name="tipo-chk"]:checked').map(i => i.value);
      const nivel = +$('input[name="precio"]:checked').value;
      const orden = $('input[name="orden"]:checked').value;

      const l = DESTINOS.filter(d =>
        (!texto || norm(d.nombre + ' ' + d.pais).includes(texto)) &&
        (!tipo.value || d.tipos.includes(tipo.value)) &&
        (!chk.length || d.tipos.some(t => chk.includes(t))) &&
        (!nivel || d.nivel === nivel)
      ).sort((a, b) => orden === 'calificacion' ? b.rating - a.rating
                     : orden === 'recientes' ? b.id - a.id
                     : b.resenas - a.resenas);

      $('#conteo').textContent = l.length + (l.length === 1 ? ' destino encontrado' : ' destinos encontrados');
      $('#resultados').innerHTML = l.length ? l.map(tarjeta).join('')
        : '<p class="msg-estado sin-resultados">No encontramos destinos con esos filtros.</p>';
      pintarFavs();
    };

    [q, tipo, $('.filtros')].forEach(el => { el.addEventListener('input', render); el.addEventListener('change', render); });
    render();
  }

  const descClima = c => c === 0 ? 'Despejado ☀️' : c <= 3 ? 'Parcialmente nublado ⛅' : c <= 48 ? 'Niebla 🌫️'
    : c <= 67 ? 'Lluvia 🌧️' : c <= 77 ? 'Nieve ❄️' : c <= 82 ? 'Chubascos 🌦️' : 'Tormenta ⛈️';

  async function cargarClima(d) {
    const box = $('#clima');
    try {
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${d.lat}&longitude=${d.lon}` +
        '&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m&timezone=auto';
      const r = await fetch(url);
      if (!r.ok) throw new Error('Respuesta inválida');
      const c = (await r.json()).current;
      box.innerHTML = `<h3>Clima actual</h3><div class="temp">${Math.round(c.temperature_2m)}°C</div>
        <p>${descClima(c.weather_code)}</p>
        <p class="datos">Humedad ${c.relative_humidity_2m}% · Viento ${Math.round(c.wind_speed_10m)} km/h</p>`;
    } catch (e) {
      box.innerHTML = '<p class="datos">No se pudo cargar el clima. Revisa tu conexión.</p>';
    }
  }

  function initVisor(d) {
    document.body.insertAdjacentHTML('beforeend', `
      <div id="visor" class="modal" hidden>
        <div class="modal-caja visor-caja" role="dialog" aria-modal="true" aria-labelledby="visor-titulo">
          <button class="cerrar" id="visor-cerrar" type="button" aria-label="Cerrar">✕</button>
          <h2 id="visor-titulo"></h2>
          <div class="visor-marco">
            <button class="visor-flecha" id="visor-ant" type="button" aria-label="Foto anterior">‹</button>
            <img id="visor-img" alt="">
            <button class="visor-flecha" id="visor-sig" type="button" aria-label="Foto siguiente">›</button>
          </div>
          <p class="datos" id="visor-pie"></p>
        </div>
      </div>`);
    const visor = $('#visor'), img = $('#visor-img');
    let i = 0;

    const mostrar = n => {
      i = (n + d.fotos.length) % d.fotos.length;
      const f = d.fotos[i];
      $('#visor-titulo').textContent = `${d.nombre} · foto ${i + 1} de ${d.fotos.length}`;
      $('#visor-pie').innerHTML = `Foto: Wikimedia Commons · <a href="${PAGINA_FOTO(f)}" target="_blank" rel="noopener">ver autor y licencia</a>`;
      img.classList.remove('error');
      img.alt = `Foto real de ${d.nombre}`;
      img.src = FOTO(f, 1200);
    };
    const cerrarVisor = () => { visor.hidden = true; };

    img.addEventListener('error', () => {
      img.classList.add('error');
      $('#visor-pie').textContent = 'No se pudo cargar la foto. Revisa tu conexión a internet.';
    });
    document.addEventListener('click', e => {
      const b = e.target.closest('[data-foto]');
      if (b) { mostrar(+b.dataset.foto); visor.hidden = false; $('#visor-cerrar').focus(); }
    });
    $('#visor-ant').addEventListener('click', () => mostrar(i - 1));
    $('#visor-sig').addEventListener('click', () => mostrar(i + 1));
    $('#visor-cerrar').addEventListener('click', cerrarVisor);
    visor.addEventListener('click', e => { if (e.target === visor) cerrarVisor(); });
    document.addEventListener('keydown', e => {
      if (visor.hidden) return;
      if (e.key === 'Escape') cerrarVisor();
      if (e.key === 'ArrowLeft') mostrar(i - 1);
      if (e.key === 'ArrowRight') mostrar(i + 1);
    });
  }

  function initDetalle() {
    const d = DESTINOS.find(x => x.id === +params.get('id'));
    const cont = $('#detalle');
    if (!d) { cont.innerHTML = '<p class="msg-estado">Destino no encontrado. <a href="destinos.html">Volver a explorar</a></p>'; return; }
    document.title = d.nombre + ' | Avynera';
    cont.innerHTML = `
      <div class="hero-det ${d.clase}" role="img" aria-label="Foto de ${d.nombre}" style="background-image:${fondo(d, 1100)}"></div>
      <a href="destinos.html" class="datos">‹ Volver</a>
      <div class="det2">
        <div>
          <h1>${d.nombre}</h1>
          <p class="datos">📍 ${d.pais} · <b class="estrella">★</b> ${d.rating} (${d.resenas.toLocaleString('es-CO')} reseñas)</p>
          <div class="chips">${d.tipos.map(t => `<span class="chip">${t}</span>`).join('')}</div>
          <p class="datos">${d.desc}</p>
          <div class="datos3">
            <div><b>🌡️ Temperatura</b>${d.temp}</div>
            <div><b>📅 Mejor época</b>${d.epoca}</div>
            <div><b>⏱️ Duración recomendada</b>${d.dias}</div>
            <div><b>🗣️ Idioma</b>${d.idioma}</div>
            <div><b>💱 Moneda</b>${d.moneda}</div>
            <div><b>🧭 Tipo de viaje</b>${d.tipos.join(' · ')}</div>
          </div>
          <h3>Lugares emblemáticos</h3>
          <ul>${d.lugares.map(l => `<li>${l}</li>`).join('')}</ul>
          <h3>Cultura y costumbres</h3>
          <p class="datos">${d.cultura}</p>
          <h3>Datos interesantes</h3>
          <ul class="curiosidades">${d.curiosidades.map(c => `<li>✨ ${c}</li>`).join('')}</ul>
          <h3>Fotos reales</h3>
          <div class="galeria">${d.fotos.map((f, i) =>
            `<button type="button" class="foto-mini" data-foto="${i}" aria-label="Ver foto ${i + 1} de ${d.nombre}" style="background-image:url('${FOTO(f, 400)}'), url('img/ciudades/${d.slug}.svg')"></button>`).join('')}</div>
          <p class="datos creditos">Fotos de Wikimedia Commons. Al abrir una foto verás el enlace a su autor y licencia.</p>
        </div>
        <aside class="panel">
          <span class="datos">Desde</span>
          <div class="precio">${cop(d.precio)}</div>
          <p class="datos">por persona</p>
          <a class="btn btn-primario boton-ancho" href="reservar.html?id=${d.id}">Reservar ahora</a>
          <button class="btn btn-secundario boton-ancho" type="button" data-fav="${d.id}"></button>
          <button class="btn btn-secundario boton-ancho" type="button" data-foto="0">📷 Ver fotos reales</button>
          <div class="clima-box" id="clima"><p class="datos">Cargando clima...</p></div>
        </aside>
      </div>`;
    pintarFavs();
    cargarClima(d);
    initVisor(d);
  }

  function initFavoritos() {
    const render = () => {
      const f = leer(FAV, []);
      const l = DESTINOS.filter(d => f.includes(d.id));
      $('#lista-fav').innerHTML = l.length ? `<div class="grid3">${l.map(tarjeta).join('')}</div>`
        : '<div class="vacio"><p>Aún no tienes destinos favoritos.</p><a class="btn btn-primario" href="destinos.html">Explorar destinos</a></div>';
      pintarFavs();
    };
    document.addEventListener('favs', render);
    render();
  }

  function initReservar() {
    const sel = $('#destino'), viaj = $('#viajeros'), u = leer(USR, null);
    sel.innerHTML = DESTINOS.map(d => `<option value="${d.id}">${d.nombre}, ${d.pais}</option>`).join('');
    if (params.get('id')) sel.value = params.get('id');
    $('#fecha').min = new Date().toISOString().slice(0, 10);
    if (u) { $('#nombre').value = u.nombre; $('#email').value = u.email; }

    const total = () => {
      const d = DESTINOS.find(x => x.id === +sel.value);
      $('#total').textContent = cop(d.precio * Math.max(1, +viaj.value || 1));
    };
    sel.addEventListener('change', total); viaj.addEventListener('input', total); total();

    $('#form-reserva').addEventListener('submit', e => {
      e.preventDefault();
      const d = DESTINOS.find(x => x.id === +sel.value), n = Math.max(1, +viaj.value || 1);
      const r = { id: Date.now(), destinoId: d.id, fecha: $('#fecha').value, viajeros: n, total: d.precio * n, estado: 'Confirmado' };
      guardar(RES, [r, ...leer(RES, [])]);
      const enlace = u ? '<a class="btn btn-primario" href="perfil.html">Ver mis reservas</a>'
                       : '<a class="btn btn-primario" href="destinos.html">Seguir explorando</a>';
      $('#zona-reserva').innerHTML = `<div class="formulario confirmacion">
        <h2>¡Reserva confirmada!</h2>
        <p>Tu viaje a <b>${d.nombre}</b> quedó reservado para el ${fmtFecha(r.fecha)}.</p>
        <p class="datos">${n} viajero(s) · Total ${cop(r.total)}</p>${enlace}</div>`;
    });
  }

  function initPerfil() {
    const u = leer(USR, null);
    if (!u) { location.href = 'login.html'; return; }
    const pintar = () => {
      const usr = leer(USR, u);
      ['#p-nombre', '#p-nombre-lat'].forEach(s => { $(s).textContent = usr.nombre; });
      ['#p-email', '#p-email-lat'].forEach(s => { $(s).textContent = usr.email; });
    };
    pintar();

    const l = leer(RES, []);
    $('#lista-reservas').innerHTML = l.length ? l.map(r => {
      const d = DESTINOS.find(x => x.id === r.destinoId) || { nombre: 'Destino', clase: 'img-1', slug: 'paris' };
      return `<div class="reserva"><div class="mini ${d.clase}" style="background-image:url('img/ciudades/${d.slug}.svg')"></div>
        <div><b>${d.nombre}</b><br><span class="datos">${fmtFecha(r.fecha)} · ${r.viajeros} viajero(s)</span></div>
        <span class="estado">${r.estado}</span></div>`;
    }).join('') : '<p class="datos">Aún no tienes reservas. <a href="destinos.html">Explora destinos</a>.</p>';

    $('#editar').addEventListener('click', () => {
      const nombre = (prompt('Escribe tu nombre:', leer(USR, u).nombre) || '').trim();
      if (nombre) { guardar(USR, { ...leer(USR, u), nombre }); pintar(); initNav(); aviso('Perfil actualizado'); }
    });
    $('#salir').addEventListener('click', e => {
      e.preventDefault();
      try { localStorage.removeItem(USR); } catch (err) {}
      location.href = 'index.html';
    });
  }

  function initLogin() {
    let registro = false;
    $('#alternar').addEventListener('click', e => {
      e.preventDefault();
      registro = !registro;
      $('#campo-nombre').hidden = !registro;
      $('#nombre').required = registro;
      $('#login-titulo').textContent = registro ? 'Crear cuenta' : 'Iniciar sesión';
      $('#btn-login').textContent = registro ? 'Registrarme' : 'Iniciar sesión';
      $('#txt-pregunta').textContent = registro ? '¿Ya tienes cuenta?' : '¿No tienes cuenta?';
      $('#alternar').textContent = registro ? 'Inicia sesión' : 'Regístrate';
    });
    $('#form-login').addEventListener('submit', e => {
      e.preventDefault();
      const email = $('#email').value.trim();
      const nombre = registro ? $('#nombre').value.trim()
        : email.split('@')[0].replace(/[._-]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
      guardar(USR, { nombre, email });
      location.href = 'perfil.html';
    });
  }

  function initContacto() {
    const u = leer(USR, null);
    if (u) { $('#c-nombre').value = u.nombre; $('#c-email').value = u.email; }
    $('#form-contacto').addEventListener('submit', e => {
      e.preventDefault();
      const m = { fecha: new Date().toISOString(), nombre: $('#c-nombre').value.trim(), email: $('#c-email').value.trim(),
                  asunto: $('#c-asunto').value, mensaje: $('#c-mensaje').value.trim() };
      guardar('avynera_mensajes', [m, ...leer('avynera_mensajes', [])]);
      const caja = document.createElement('div'); caja.className = 'formulario confirmacion';
      const h = document.createElement('h2'); h.textContent = '¡Mensaje enviado!';
      const p = document.createElement('p'); p.textContent = `Gracias, ${m.nombre}. Recibimos tu mensaje sobre "${m.asunto}".`;
      const a = document.createElement('a'); a.className = 'btn btn-primario'; a.href = 'index.html'; a.textContent = 'Volver al inicio';
      caja.append(h, p, a);
      $('#zona-contacto').replaceChildren(caja);
    });
  }
  
  const paginas = { index: initIndex, destinos: initDestinos, detalle: initDetalle, favoritos: initFavoritos,
                    reservar: initReservar, perfil: initPerfil, login: initLogin, contacto: initContacto };
  initNav();
  (paginas[document.body.dataset.page] || (() => {}))();
})();
