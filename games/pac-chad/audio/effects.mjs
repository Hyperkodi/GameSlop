// Production prompts, not a claim that audio has already been generated.
const style = 'Original modern arcade maze-chase game sound. Crisp, playful electronic sound design with a little tactile texture. Immediate attack, clean short decay. One isolated effect, no speech, no music bed, no ambient noise, no recognizable existing game melody. ';
export const MODEL = 'eleven_text_to_sound_v2';
export const FORMAT = 'mp3_44100_128';
export const EFFECTS = [
  ['pellet',.5,.13,.12,'A single tiny soft rubbery mouth chomp with a rounded digital pop, very short, gentle and satisfying enough to repeat rapidly. Finish the bite within the first tenth of a second; the remainder is silence.'],
  ['power',1.2,.38,.3,'A powerful rising electric gulp blooming into a bright shimmering energy surge. The player has become invincible.'],
  ['ghost',.7,.32,.09,'A punchy cartoon spectral pop and quick upward digital sparkle, rewarding a captured ghost.'],
  ['dash',.6,.28,.2,'A fast tight air whoosh with a bright electronic zip. Sudden forward burst of speed.'],
  ['decoy',.9,.3,.2,'A hollow holographic bloop splitting into two glittery echoes, a ghostly duplicate materializing.'],
  ['hit',.8,.36,.3,'A soft arcade impact thud followed by a short descending electronic wobble, losing one life. No human pain sounds.'],
  ['warning',.5,.2,.45,'A sharp but quiet double radar chirp that warns an enemy is about to charge. Urgent and readable, not piercing.'],
  ['gate-warning',.7,.22,.5,'Three quick ascending digital ticks announcing a shortcut will open soon.'],
  ['gate',.9,.28,.3,'A compact sci-fi sliding latch opening with a soft mechanical click and bright ascending ping.'],
  ['combo',.6,.25,.2,'A short rewarding two-note rising crystalline combo chime with a warm bouncy finish.'],
  ['stage',1.8,.36,.5,'A brief triumphant arcade flourish of bright ascending synth tones and a satisfying final sparkling accent for clearing a maze.'],
  ['start',.8,.3,.5,'A bright punchy rising ready-go arcade stinger ending with a decisive clean electronic ping.'],
  ['end',1.7,.34,.5,'A short descending playful arcade run-complete stinger, warm and rounded with a final soft digital plop.']
].map(([id,duration,volume,cooldown,prompt])=>({id,duration,volume,cooldown,prompt:style+prompt}));
