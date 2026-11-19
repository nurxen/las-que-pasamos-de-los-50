// Textos: frases de ánimo, sugerencias de retos, emojis... ¡Edítalos a vuestro gusto!

export const PHRASES = [
  "Esta semana la protagonista de la serie eres tú. ✨",
  "Tu sofá puede esperar. Tus retos, no. 🛋️➡️🏃‍♀️",
  "Un café, un reto y a comerse el mundo. ☕",
  "No hace falta ser perfecta, hace falta ser constante. 💪",
  "Las amigas que se retan juntas, brindan juntas. 🥂",
  "Hoy es un buen día para tachar algo de la lista. ✅",
  "Paso a paso también se llega a Nueva York. 🗽",
  "Si te cuesta, es que te está cambiando. 🦋",
  "Tacones o zapatillas: lo importante es moverse. 👠👟",
  "El domingo el grupo pasa lista… ¡que te pille con los deberes hechos! 😉",
  "Pequeños gestos, grandes cambios. 🌱",
  "Tú puedes con esto y con mucho más. 👑",
  "Hoy toca brillar un poquito más que ayer. 🌟",
  "Las mejores historias empiezan con un «¿y si lo intento?». 📖",
  "Tus amigas te miran… ¡dales algo que aplaudir! 👏",
  "Ni lunes ni excusas: empieza ahora. ⏰",
  "Cuidarte no es egoísmo, es amor propio. 💖",
  "Cada reto cumplido es un brindis pendiente. 🍸",
  "A los 50 no se baja el ritmo: se elige el ritmo. 💃",
  "Lo difícil no es empezar, es no rendirse. ¡Y tú no te rindes! 🔥",
  "Un día malo no estropea una semana buena. 🌈",
  "Hoy, un poquito mejor que ayer. Mañana, otro poquito. 📈",
  "La constancia es el mejor accesorio. 💎",
  "Que el grupo te vea llegar con todo hecho. 😎",
  "Tómate un momento para ti: te lo mereces. 🌸",
  "Las amigas de verdad te empujan… hacia tus metas. 🤗",
  "Si ella puede, tú también. Y si tú puedes, ellas también. 🫶",
  "Hoy eres la reina de tu propia historia. 👑",
];

// Frase según el porcentaje conseguido
export function phraseForPct(p) {
  if (p >= 1) return "¡PLENO! Eres una auténtica reina. 👑🎉";
  if (p >= 0.75) return "¡Casi lo tienes! Un último empujón y a celebrar. 🥂";
  if (p >= 0.5) return "Vas por la mitad, ¡y lo mejor está por llegar! 💪";
  if (p > 0) return "Ya has arrancado, que es lo más difícil. ¡Sigue así! 🌱";
  return "Esta semana aún está por escribir. ¿Empezamos hoy? ✍️";
}

export function weekVerdict(p) {
  if (p >= 1) return { title: "¡Semana perfecta!", emoji: "🏆", text: "Lo has conseguido TODO. Hoy toca celebrarlo." };
  if (p >= 0.75) return { title: "¡Conseguido!", emoji: "🎉", text: "Has cumplido casi todo. ¡Enhorabuena!" };
  if (p >= 0.5) return { title: "¡Bien hecho!", emoji: "👍", text: "Más de la mitad cumplida. La próxima, a por el pleno." };
  if (p > 0) return { title: "Buen intento", emoji: "🌱", text: "Algo has avanzado. La semana que viene, con más ganas." };
  return { title: "Semana en blanco", emoji: "☕", text: "No pasa nada: el lunes empieza otra oportunidad." };
}

export function groupVerdict(p) {
  if (p >= 0.9) return { title: "¡Lo habéis petado, chicas!", emoji: "🥂", text: "El grupo entero ha cumplido. Esto merece un brunch." };
  if (p >= 0.7) return { title: "¡Lo habéis conseguido!", emoji: "🎉", text: "Como grupo, habéis cumplido la mayoría de los retos." };
  if (p >= 0.5) return { title: "¡Vamos por buen camino!", emoji: "💪", text: "Más de la mitad entre todas. ¡La próxima, a por más!" };
  if (p > 0) return { title: "Semana flojita…", emoji: "☕", text: "Hay que apretar un poco. ¡Animaos entre vosotras!" };
  return { title: "Aún sin datos", emoji: "🗓️", text: "Nadie ha apuntado nada esta semana todavía." };
}

// Sugerencias de retos.  mode: 'dias' = marcar días de la semana; 'cantidad' = sumar números
export const SUGGESTIONS = [
  { cat: "Muévete", icon: "🏃‍♀️", items: [
    { emoji: "🚶‍♀️", title: "Andar", mode: "cantidad", target: 5, unit: "km" },
    { emoji: "👟", title: "Dar un paseo de 30 minutos", mode: "dias", target: 4 },
    { emoji: "🧘‍♀️", title: "Hacer estiramientos o yoga", mode: "dias", target: 3 },
    { emoji: "🏊‍♀️", title: "Ir a nadar o al gimnasio", mode: "dias", target: 2 },
    { emoji: "💃", title: "Bailar una canción entera", mode: "dias", target: 3 },
    { emoji: "🪜", title: "Subir por las escaleras", mode: "dias", target: 5 },
  ]},
  { cat: "Come rico y sano", icon: "🥗", items: [
    { emoji: "🥗", title: "Comer saludable", mode: "dias", target: 5 },
    { emoji: "💧", title: "Beber 2 litros de agua", mode: "dias", target: 5 },
    { emoji: "🍎", title: "Tomar fruta", mode: "dias", target: 6 },
    { emoji: "🍬", title: "Sin dulces ni bollería", mode: "dias", target: 5 },
    { emoji: "🍷", title: "Sin alcohol entre semana", mode: "dias", target: 5 },
    { emoji: "👩‍🍳", title: "Cocinar una receta nueva", mode: "cantidad", target: 1, unit: "receta" },
  ]},
  { cat: "Mente y calma", icon: "🧠", items: [
    { emoji: "📖", title: "Leer", mode: "cantidad", target: 100, unit: "páginas" },
    { emoji: "📚", title: "Terminar un libro", mode: "cantidad", target: 1, unit: "libro" },
    { emoji: "😴", title: "Dormir 7 horas", mode: "dias", target: 5 },
    { emoji: "📵", title: "Nada de móvil después de cenar", mode: "dias", target: 4 },
    { emoji: "🙏", title: "Meditar 10 minutos", mode: "dias", target: 3 },
    { emoji: "✍️", title: "Escribir 3 cosas buenas del día", mode: "dias", target: 5 },
    { emoji: "🇬🇧", title: "Practicar un idioma", mode: "dias", target: 3 },
  ]},
  { cat: "Para mí", icon: "💅", items: [
    { emoji: "🧴", title: "Rutina de cuidado de la piel", mode: "dias", target: 5 },
    { emoji: "🎨", title: "Dedicar un rato a mi hobby", mode: "dias", target: 2 },
    { emoji: "🎬", title: "Ver una peli o ir al teatro", mode: "cantidad", target: 1, unit: "plan" },
    { emoji: "🌳", title: "Salir a la naturaleza", mode: "cantidad", target: 1, unit: "escapada" },
    { emoji: "🛁", title: "Un baño o momento de mimos", mode: "cantidad", target: 1, unit: "vez" },
  ]},
  { cat: "Gente y casa", icon: "🏡", items: [
    { emoji: "📞", title: "Llamar a alguien que quiero", mode: "cantidad", target: 2, unit: "llamadas" },
    { emoji: "☕", title: "Quedar con una amiga", mode: "cantidad", target: 1, unit: "quedada" },
    { emoji: "🧹", title: "Ordenar un cajón o armario", mode: "cantidad", target: 1, unit: "cajón" },
    { emoji: "🌿", title: "Cuidar las plantas", mode: "dias", target: 2 },
    { emoji: "💸", title: "No hacer compras caprichosas", mode: "dias", target: 7 },
  ]},
];

export const CHALLENGE_EMOJIS = ["⭐","🚶‍♀️","🏃‍♀️","🧘‍♀️","🏊‍♀️","💃","🚴‍♀️","🥗","💧","🍎","🍬","🍷","📖","📚","😴","📵","🙏","✍️","🧴","🎨","🌳","📞","☕","🧹","🌿","💸","🎯","❤️","🎵","🐶"];

export const AVATARS = ["🌸","🌺","🌻","🌷","🦋","👑","💃","🍸","☕","🧁","🍓","🌙","⭐","💎","🐱","🦩","👠","💄","🎀","🌈","🍋","🌵","🐞","🦄"];

export const COLORS = ["#E8579B","#7B3FA0","#F28C38","#2E9C9A","#D94848","#3D7DD8","#C9A227","#4E9F3D"];

export const CHEER_EMOJIS = ["👏","❤️","🔥","💪"];
