# ☕ Las Retadoras 🍸

App web de retos personales entre amigas. Se abre con un enlace, se puede añadir a la pantalla del móvil como si fuera una app y los datos se comparten entre todas gracias a Supabase.

**Coste: 0 €** (GitHub Pages y el plan gratuito de Supabase).

---

## Puesta en marcha (unos 15 minutos, una sola vez)

### Paso 1 · Crear la base de datos en Supabase
1. Entra en <https://supabase.com> → **New project**. Ponle de nombre `retadoras`, elige una contraseña cualquiera (no la vais a usar en la app) y como región **Europe (Frankfurt o Paris)**.
2. Cuando termine de crearse, en el menú de la izquierda entra en **SQL Editor** → **New query**.
3. Abre el archivo `supabase/schema.sql` de este zip, copia **todo** el contenido, pégalo y pulsa **Run**. Tiene que salir "Success".
   - 🔑 La **contraseña del grupo** es `amigas`. Para cambiarla, edita en ese archivo la línea que pone `values ('group_code', 'amigas')` antes de pulsar Run, o vuelve a ejecutar solo esa línea con otra palabra.
4. Ve a **Project Settings → API** (o al botón **Connect**) y copia estos dos datos:
   - **Project URL** → algo como `https://abcdefgh.supabase.co`
   - La clave pública: **anon public** (empieza por `eyJ...`) o **publishable** (empieza por `sb_publishable_...`). ⚠️ No uses nunca la `service_role` ni la `secret`.

### Paso 2 · Poner tus datos en la app
Abre `js/config.js` y pega los dos datos entre las comillas:
```js
SUPABASE_URL: "https://abcdefgh.supabase.co",
SUPABASE_KEY: "eyJhbGciOi....",
```
Si los dejas vacíos, la app funciona en **MODO DEMO** con 5 amigas de ejemplo (solo en tu navegador). Así puedes verla antes de configurarla.

### Paso 3 · Subirla a GitHub y publicarla
1. En GitHub → **New repository** → nombre `retadoras` → **Public** → Create.
2. Pulsa **uploading an existing file** y arrastra **todo el contenido de la carpeta** (no la carpeta en sí: `index.html` tiene que quedar en la raíz). → **Commit changes**.
3. Ve a **Settings → Pages** → en *Branch* elige `main` y carpeta `/ (root)` → **Save**.
4. En 1-2 minutos tendrás el enlace: `https://TU-USUARIO.github.io/retadoras/`

### Paso 4 · Mandar el enlace al grupo
Manda por WhatsApp el enlace y la contraseña del grupo. Cada una:
1. Abre el enlace (iPhone: en **Safari**; Android: en **Chrome**).
2. Ve el tutorial, escribe la contraseña y toca **«Soy nueva»** para crear su perfil.
3. La pone en la pantalla de inicio: iPhone → botón Compartir ⬆️ → **Añadir a pantalla de inicio**. Android → ⋮ → **Instalar aplicación**. (También está explicado dentro de la app, en *Mi perfil*.)

---

## Qué tiene la app
- **Tutorial** sencillo de 5 pantallas al entrar por primera vez.
- **Mi semana**: frase de ánimo del día, tu % de la semana, tus retos y botones grandes para apuntar.
  - Retos **por días** (comer sano 5 días) → se tocan los días L M X J V S D.
  - Retos **por cantidad** (5 km, 100 páginas, 1 libro) → botón «Apuntar».
  - Confeti 🎉 cuando cumples un reto y cuando haces pleno.
- **Más de 30 ideas de retos** en 5 categorías: Muévete, Come rico y sano, Mente y calma, Para mí, Gente y casa.
- **Las chicas**: el progreso de cada una y botones para mandar ánimos 👏 ❤️ 🔥 💪.
- **Resumen** (lunes a domingo): % del grupo, veredicto («¡Lo habéis conseguido!»), clasificación, 👑 reina de la semana, 📣 la más animadora y el historial de semanas anteriores.
- **Mi perfil**: nombre, dibujito, color y lema; racha de semanas, retos cumplidos y medallas.
- Se actualiza sola en tiempo real cuando otra apunta algo.

## Cómo se calcula
- Cada reto se cumple al llegar al objetivo semanal (lo que se pase cuenta como 100%).
- Tu % semanal es la media de tus retos. El del grupo es la media de las que tienen retos.
- Una semana cuenta como **conseguida** a partir del 75%, y es **perfecta** al 100%.
- Si quitas un reto, desaparece desde esa semana, pero las semanas anteriores se quedan como estaban.

## Personalizar
- Frases, ideas de retos, dibujitos y colores: `js/content.js`
- Nombre de la app: `js/config.js` (`APP_NAME`)
- Colores y letras: arriba del todo en `css/styles.css`

## Sobre la privacidad
Para que sea fácil, no hay usuarias con contraseña: cualquiera que tenga el enlace **y la contraseña del grupo** puede entrar. La clave pública de Supabase está dentro del código (es normal en este tipo de apps), así que alguien con conocimientos técnicos podría llegar a leer los datos. Para retos entre amigas suele ser suficiente, pero no guardéis nada delicado.

## Si algo falla
- **«No puedo conectar»** → revisa que en `js/config.js` la URL y la clave estén bien copiadas, entre comillas, y que ejecutaste `schema.sql`.
- **No veo los cambios después de subir algo nuevo a GitHub** → espera 2 minutos y cierra y vuelve a abrir la app.
- **Una amiga eligió el nombre equivocado** → Mi perfil → «No soy… (cambiar de persona)».
- **Supabase pausa los proyectos gratis** si pasan 7 días sin que nadie entre. Si os pasa, entra en supabase.com y pulsa *Restore*.
