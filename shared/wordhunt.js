// Word Hunt (issue #51): a seeded Boggle-style letter grid. Every player in a
// round sees the identical NxN grid and finds as many real words as they can by
// tracing 8-directional adjacency paths. The grid is PUBLIC (it must render for
// every player); scoring is server-authoritative — a submitted word counts only
// if it is BOTH in the curated offline WORDLIST AND forms a real adjacency path
// on this grid. No Math.random(): buildGrid(seed) is a pure function of its seed
// so two clients drawing the same seed get byte-identical grids.

import { seededRng } from './rng.js';

// Boggle-style dice: sixteen faces, each a set of six letters, one letter shown
// per die. This biases the board toward playable letter frequencies (plenty of
// vowels and common consonants) far better than a uniform draw, so a 4x4 board
// reliably contains findable words. 'Q' pairs with 'U' as "Qu" would in real
// Boggle, but to keep single-cell letters and the path check simple we treat it
// as a plain single-cell 'q': a 'q' die shows just "q", and the few q-words in
// the WORDLIST path through that one cell like any other letter.
const DICE = [
  'aaeegn', 'abbjoo', 'achops', 'affkps',
  'aoottw', 'cimotu', 'deilrx', 'delrvy',
  'distty', 'eeghnw', 'eeinsu', 'ehrtvw',
  'eiosst', 'elrtty', 'himnqu', 'hlnnrz',
];

// A curated set of common lowercase English words, length 3–8. No proper nouns,
// no profanity. Kept intentionally broad enough that a random 4x4 board almost
// always yields at least one findable entry, and small enough to stay readable.
export const WORDLIST = new Set([
  // 3-letter
  'ace', 'act', 'add', 'age', 'ago', 'aid', 'aim', 'air', 'ale', 'all', 'and',
  'ant', 'any', 'ape', 'apt', 'arc', 'are', 'arm', 'art', 'ash', 'ate', 'awe',
  'bad', 'bag', 'ban', 'bar', 'bat', 'bay', 'bed', 'bee', 'beg', 'bet', 'bid',
  'big', 'bin', 'bit', 'boa', 'bog', 'bot', 'bow', 'box', 'boy', 'bud', 'bug',
  'bun', 'bus', 'but', 'buy', 'cab', 'can', 'cap', 'car', 'cat', 'cob', 'cod',
  'cog', 'con', 'cop', 'cot', 'cow', 'cry', 'cub', 'cue', 'cup', 'cut', 'dab',
  'dam', 'day', 'den', 'dew', 'did', 'die', 'dig', 'dim', 'dip', 'doe', 'dog',
  'dot', 'dry', 'dub', 'due', 'dug', 'ear', 'eat', 'ebb', 'eel', 'egg', 'ego',
  'elf', 'elk', 'elm', 'end', 'era', 'eve', 'eye', 'fan', 'far', 'fat', 'fed',
  'fee', 'few', 'fig', 'fin', 'fit', 'fix', 'fly', 'foe', 'fog', 'for', 'fox',
  'fry', 'fun', 'fur', 'gap', 'gas', 'gem', 'get', 'gin', 'god', 'got', 'gum',
  'gun', 'gut', 'guy', 'gym', 'had', 'ham', 'has', 'hat', 'hay', 'hen', 'her',
  'hew', 'hid', 'him', 'hip', 'his', 'hit', 'hoe', 'hog', 'hop', 'hot', 'how',
  'hub', 'hue', 'hug', 'hum', 'hut', 'ice', 'icy', 'ill', 'ink', 'inn', 'ion',
  'ire', 'ivy', 'jab', 'jam', 'jar', 'jaw', 'jet', 'job', 'jog', 'joy', 'jug',
  'keg', 'key', 'kid', 'kin', 'kit', 'lab', 'lad', 'lag', 'lap', 'law', 'lax',
  'lay', 'led', 'leg', 'let', 'lid', 'lie', 'lip', 'lit', 'log', 'lot', 'low',
  'mad', 'man', 'map', 'mat', 'may', 'men', 'met', 'mix', 'mob', 'mod', 'mom',
  'mop', 'mud', 'mug', 'nab', 'nap', 'nay', 'net', 'new', 'nil', 'nip', 'nod',
  'nor', 'not', 'now', 'nut', 'oak', 'oar', 'oat', 'odd', 'off', 'oil', 'old',
  'one', 'orb', 'ore', 'our', 'out', 'owe', 'owl', 'own', 'pad', 'pal', 'pan',
  'pat', 'paw', 'pay', 'pea', 'peg', 'pen', 'pet', 'pie', 'pig', 'pin', 'pit',
  'ply', 'pod', 'pop', 'pot', 'pow', 'pro', 'pry', 'pub', 'pun', 'pup', 'put',
  'rag', 'ram', 'ran', 'rap', 'rat', 'raw', 'ray', 'red', 'rib', 'rid', 'rig',
  'rim', 'rip', 'rob', 'rod', 'rot', 'row', 'rub', 'rug', 'run', 'rut', 'sad',
  'sag', 'sat', 'saw', 'say', 'sea', 'see', 'set', 'sew', 'shy', 'sin', 'sip',
  'sir', 'sit', 'six', 'ski', 'sky', 'sly', 'sob', 'sod', 'son', 'sow', 'soy',
  'spa', 'spy', 'sty', 'sub', 'sue', 'sum', 'sun', 'tab', 'tad', 'tag', 'tan',
  'tap', 'tar', 'tax', 'tea', 'ten', 'the', 'thy', 'tie', 'tin', 'tip', 'toe',
  'ton', 'too', 'top', 'tow', 'toy', 'try', 'tub', 'tug', 'urn', 'use', 'van',
  'vat', 'vet', 'via', 'vie', 'vow', 'wad', 'wag', 'war', 'was', 'wax', 'way',
  'web', 'wed', 'wet', 'who', 'why', 'wig', 'win', 'wit', 'woe', 'wok', 'won',
  'wow', 'yak', 'yam', 'yaw', 'yes', 'yet', 'zip', 'zoo',
  // 4-letter
  'able', 'acre', 'acid', 'aide', 'ally', 'ante', 'atom', 'axle', 'baby',
  'bake', 'bald', 'ball', 'band', 'bane', 'bank', 'bare', 'barn', 'base',
  'bath', 'beam', 'bean', 'bear', 'beat', 'been', 'bell', 'belt', 'bend',
  'best', 'bird', 'bite', 'blot', 'blow', 'blue', 'boat', 'body', 'bold',
  'bolt', 'bone', 'book', 'boot', 'bore', 'born', 'boss', 'both', 'bowl',
  'brew', 'brow', 'bulk', 'bull', 'burn', 'bush', 'busy', 'cage', 'cake',
  'calm', 'came', 'camp', 'cane', 'cape', 'card', 'care', 'cart', 'case',
  'cash', 'cast', 'cave', 'cell', 'cent', 'chat', 'chef', 'chin', 'chip',
  'city', 'clap', 'claw', 'clay', 'clip', 'clot', 'club', 'clue', 'coal',
  'coat', 'code', 'coin', 'cold', 'cone', 'cook', 'cool', 'cope', 'copy',
  'cord', 'core', 'cork', 'corn', 'cost', 'crew', 'crop', 'crow', 'cube',
  'curl', 'cute', 'dare', 'dark', 'dart', 'dash', 'date', 'dawn', 'daze',
  'deaf', 'deal', 'dear', 'debt', 'deck', 'deed', 'deep', 'deer', 'dent',
  'desk', 'dial', 'dice', 'diet', 'dime', 'dine', 'dirt', 'dish', 'dive',
  'dock', 'does', 'dome', 'done', 'doom', 'door', 'dose', 'dove', 'down',
  'drag', 'draw', 'drew', 'drip', 'drop', 'drum', 'duck', 'dull', 'dune',
  'dusk', 'dust', 'duty', 'each', 'earl', 'earn', 'ease', 'east', 'easy',
  'echo', 'edge', 'else', 'even', 'ever', 'evil', 'exit', 'face', 'fact',
  'fade', 'fail', 'fair', 'fall', 'fame', 'farm', 'fast', 'fate', 'fear',
  'feed', 'feel', 'feet', 'fell', 'felt', 'fern', 'file', 'fill', 'film',
  'find', 'fine', 'fire', 'firm', 'fish', 'fist', 'five', 'flag', 'flat',
  'flaw', 'flew', 'flip', 'flow', 'foam', 'fold', 'folk', 'fond', 'font',
  'food', 'fool', 'foot', 'ford', 'fork', 'form', 'fort', 'foul', 'four',
  'free', 'frog', 'fuel', 'full', 'fund', 'gain', 'gale', 'game', 'gate',
  'gave', 'gaze', 'gear', 'gene', 'gift', 'girl', 'give', 'glad', 'glow',
  'glue', 'goal', 'goat', 'gold', 'golf', 'gone', 'good', 'gown', 'grab',
  'gray', 'grew', 'grid', 'grim', 'grin', 'grip', 'grow', 'gulf', 'hail',
  'hair', 'half', 'hall', 'halt', 'hand', 'hang', 'hard', 'hare', 'harm',
  'hate', 'have', 'hawk', 'haze', 'head', 'heal', 'heap', 'hear', 'heat',
  'heel', 'held', 'hell', 'helm', 'help', 'herb', 'herd', 'hero', 'hide',
  'high', 'hike', 'hill', 'hint', 'hire', 'hold', 'hole', 'holy', 'home',
  'hood', 'hook', 'hope', 'horn', 'hose', 'host', 'hour', 'huge', 'hunt',
  'hurt', 'hush', 'icon', 'idea', 'idle', 'inch', 'iron', 'item', 'jade',
  'jail', 'jazz', 'jest', 'join', 'joke', 'jolt', 'jump', 'june', 'junk',
  'jury', 'just', 'keen', 'keep', 'kept', 'kick', 'kind', 'king', 'kiss',
  'kite', 'knee', 'knew', 'knit', 'knot', 'know', 'lace', 'lack', 'lady',
  'laid', 'lake', 'lamb', 'lamp', 'land', 'lane', 'last', 'late', 'lawn',
  'lazy', 'lead', 'leaf', 'lean', 'leap', 'left', 'lend', 'lens', 'less',
  'life', 'lift', 'like', 'limb', 'lime', 'line', 'link', 'lion', 'list',
  'live', 'load', 'loaf', 'loan', 'lock', 'loft', 'lone', 'long', 'look',
  'loop', 'lord', 'lose', 'loss', 'lost', 'loud', 'love', 'luck', 'lump',
  'lung', 'lure', 'made', 'mail', 'main', 'make', 'male', 'mall', 'mane',
  'many', 'mare', 'mark', 'mask', 'mass', 'mast', 'mate', 'math', 'meal',
  'mean', 'meat', 'meet', 'melt', 'mend', 'menu', 'mere', 'mesh', 'mess',
  'mild', 'mile', 'milk', 'mill', 'mind', 'mine', 'mint', 'miss', 'mist',
  'moan', 'mock', 'mode', 'mold', 'mole', 'monk', 'mood', 'moon', 'more',
  'moss', 'most', 'moth', 'move', 'much', 'mule', 'mush', 'must', 'mute',
  'nail', 'name', 'near', 'neat', 'neck', 'need', 'nest', 'news', 'next',
  'nice', 'nine', 'node', 'none', 'noon', 'nose', 'note', 'nova', 'oath',
  'oats', 'obey', 'odor', 'omit', 'once', 'only', 'onto', 'open', 'oral',
  'oven', 'over', 'pace', 'pack', 'pact', 'page', 'paid', 'pail', 'pain',
  'pair', 'pale', 'palm', 'pane', 'park', 'part', 'pass', 'past', 'path',
  'pave', 'peak', 'pear', 'peel', 'peer', 'pest', 'pick', 'pier', 'pile',
  'pine', 'pink', 'pint', 'pipe', 'plan', 'play', 'plea', 'plot', 'plow',
  'plug', 'plum', 'poem', 'poet', 'pole', 'poll', 'pond', 'pony', 'pool',
  'poor', 'pope', 'pork', 'port', 'pose', 'post', 'pour', 'pray', 'prey',
  'prom', 'prop', 'pull', 'pump', 'punk', 'pure', 'push', 'quit', 'race',
  'rack', 'raft', 'rage', 'raid', 'rail', 'rain', 'rake', 'ramp',
  'rang', 'rank', 'rare', 'rate', 'rave', 'read', 'real', 'reap', 'rear',
  'reed', 'reef', 'rely', 'rent', 'rest', 'rice', 'rich', 'ride', 'ring',
  'ripe', 'rise', 'risk', 'road', 'roam', 'roar', 'robe', 'rock', 'rode',
  'role', 'roll', 'roof', 'room', 'root', 'rope', 'rose', 'ruby', 'rude',
  'ruin', 'rule', 'rung', 'rush', 'rust', 'sack', 'safe', 'sage', 'said',
  'sail', 'sake', 'sale', 'salt', 'same', 'sand', 'sane', 'sang', 'sank',
  'save', 'scan', 'scar', 'seal', 'seam', 'seat', 'seed', 'seek', 'seem',
  'seen', 'self', 'sell', 'send', 'sent', 'shed', 'ship', 'shoe', 'shop',
  'shot', 'show', 'shut', 'sick', 'side', 'sigh', 'sign', 'silk', 'sing',
  'sink', 'site', 'size', 'skin', 'slab', 'slam', 'slap', 'sled', 'slid',
  'slim', 'slip', 'slot', 'slow', 'snap', 'snow', 'soak', 'soap', 'soar',
  'sock', 'sofa', 'soft', 'soil', 'sold', 'sole', 'some', 'song', 'soon',
  'sore', 'sort', 'soul', 'soup', 'sour', 'span', 'spar', 'spin', 'spit',
  'spot', 'spur', 'stab', 'stag', 'star', 'stay', 'stem', 'step', 'stew',
  'stir', 'stop', 'stow', 'stub', 'stun', 'such', 'suit', 'sunk', 'sure',
  'swap', 'swim', 'tack', 'tail', 'take', 'tale', 'talk', 'tall', 'tame',
  'tank', 'tape', 'task', 'taxi', 'team', 'tear', 'tell', 'tend', 'tent',
  'term', 'test', 'text', 'than', 'that', 'thaw', 'thee', 'them', 'then',
  'thin', 'this', 'thus', 'tick', 'tide', 'tidy', 'tile', 'till', 'tilt',
  'time', 'tiny', 'toad', 'toil', 'told', 'toll', 'tomb', 'tone', 'took',
  'tool', 'torn', 'tour', 'town', 'trap', 'tray', 'tree', 'trim', 'trip',
  'trot', 'true', 'tube', 'tuck', 'tune', 'turn', 'twin', 'type', 'ugly',
  'undo', 'unit', 'upon', 'urge', 'used', 'user', 'vain', 'vale', 'vary',
  'vase', 'vast', 'veil', 'vein', 'vent', 'verb', 'very', 'vest', 'veto',
  'vice', 'view', 'vine', 'void', 'vote', 'wade', 'wage', 'wail', 'wait',
  'wake', 'walk', 'wall', 'wand', 'want', 'ward', 'ware', 'warm', 'warn',
  'wart', 'wash', 'wave', 'wavy', 'weak', 'wear', 'weed', 'week', 'weep',
  'well', 'went', 'were', 'west', 'what', 'when', 'whip', 'whom', 'wide',
  'wife', 'wild', 'will', 'wilt', 'wind', 'wine', 'wing', 'wink', 'wipe',
  'wire', 'wise', 'wish', 'with', 'woke', 'wolf', 'wood', 'wool', 'word',
  'wore', 'work', 'worm', 'worn', 'wrap', 'yard', 'yarn', 'yawn', 'year',
  'yell', 'yoga', 'yolk', 'your', 'zero', 'zone', 'zoom',
  // 5-letter
  'about', 'above', 'actor', 'adore', 'agent', 'alarm', 'alert', 'alike',
  'alive', 'allow', 'alone', 'aloud', 'amber', 'angel', 'anger', 'angle',
  'ankle', 'apart', 'apple', 'apron', 'arena', 'argue', 'arise', 'aroma',
  'array', 'arrow', 'aside', 'asset', 'audio', 'aunts', 'awake', 'award',
  'aware', 'badge', 'baker', 'basin', 'basic', 'basil', 'beach', 'beads',
  'beard', 'beast', 'began', 'begin', 'being', 'below', 'bench', 'berry',
  'birch', 'birth', 'black', 'blade', 'blame', 'blank', 'blast', 'blaze',
  'bleak', 'blend', 'bless', 'blind', 'blink', 'block', 'blood', 'bloom',
  'board', 'boast', 'bonus', 'boost', 'booth', 'bound', 'brain', 'brake',
  'brand', 'brave', 'bread', 'break', 'brick', 'bride', 'brief', 'bring',
  'brink', 'brisk', 'broad', 'brook', 'broom', 'brown', 'brush', 'build',
  'built', 'bunch', 'burnt', 'cabin', 'cable', 'camel', 'canal', 'candy',
  'cargo', 'carol', 'carry', 'catch', 'cause', 'chain', 'chair', 'chalk',
  'charm', 'chart', 'chase', 'cheap', 'cheek', 'cheer', 'chess', 'chest',
  'chief', 'child', 'chill', 'chime', 'chose', 'churn', 'claim', 'clamp',
  'clash', 'class', 'clean', 'clear', 'clerk', 'click', 'cliff', 'climb',
  'cling', 'cloak', 'clock', 'close', 'cloth', 'cloud', 'clown', 'coast',
  'cocoa', 'color', 'coral', 'couch', 'cough', 'could', 'count', 'court',
  'cover', 'crack', 'craft', 'crane', 'crash', 'crawl', 'crazy', 'cream',
  'creek', 'crest', 'crisp', 'crown', 'crumb', 'crush', 'crust', 'cubic',
  'curve', 'daily', 'dairy', 'daisy', 'dance', 'dandy', 'delay', 'delta',
  'dense', 'depth', 'diary', 'digit', 'dimly', 'dined', 'diner', 'dirty',
  'ditch', 'diver', 'dizzy', 'donor', 'dough', 'dozen', 'draft', 'drain',
  'drama', 'drank', 'drawn', 'dread', 'dream', 'dress', 'dried', 'drift',
  'drill', 'drink', 'drive', 'drone', 'drove', 'drown', 'dwell', 'eager',
  'eagle', 'early', 'earth', 'ebony', 'eight', 'elbow', 'elder', 'elect',
  'elite', 'ember', 'empty', 'enact', 'ended', 'enjoy', 'enter', 'entry',
  'equal', 'erase', 'error', 'essay', 'event', 'every', 'exact', 'exile',
  'exist', 'extra', 'fable', 'faced', 'faint', 'fairy', 'faith', 'false',
  'fancy', 'fatal', 'fault', 'favor', 'feast', 'fence', 'ferry', 'fetch',
  'fever', 'fiber', 'field', 'fiery', 'fifth', 'fifty', 'fight', 'final',
  'finch', 'first', 'flame', 'flash', 'fleet', 'flesh', 'flint', 'float',
  'flock', 'flood', 'floor', 'flour', 'flown', 'fluid', 'flush', 'focal',
  'focus', 'foggy', 'force', 'forge', 'forth', 'forty', 'found', 'frame',
  'frank', 'fraud', 'fresh', 'front', 'frost', 'fruit', 'funny', 'gauge',
  'ghost', 'giant', 'given', 'glare', 'glass', 'gleam', 'globe', 'gloom',
  'glory', 'glove', 'grace', 'grade', 'grain', 'grand', 'grant', 'grape',
  'graph', 'grasp', 'grass', 'grave', 'great', 'greed', 'green', 'greet',
  'grief', 'grill', 'grind', 'groan', 'groom', 'gross', 'group', 'grove',
  'grown', 'guard', 'guess', 'guest', 'guide', 'guilt', 'habit', 'happy',
  'hardy', 'harsh', 'haste', 'hatch', 'haunt', 'heart', 'heavy', 'hedge',
  'hello', 'hobby', 'honey', 'honor', 'horse', 'hotel', 'hound', 'house',
  'hover', 'human', 'humor', 'hurry', 'ideal', 'image', 'index', 'inner',
  'input', 'issue', 'ivory', 'jelly', 'jewel', 'joint', 'joker', 'jolly',
  'juice', 'kayak', 'kneel', 'knife', 'knock', 'known', 'label', 'labor',
  'large', 'later', 'laugh', 'layer', 'learn', 'lease', 'least', 'leave',
  'ledge', 'lemon', 'level', 'lever', 'light', 'limit', 'liner', 'liver',
  'lobby', 'local', 'lodge', 'logic', 'loose', 'lorry', 'loser', 'lover',
  'lower', 'loyal', 'lucky', 'lunar', 'lunch', 'lyric', 'magic', 'major',
  'maker', 'mango', 'manor', 'maple', 'march', 'marsh', 'match', 'metal',
  'meter', 'midst', 'might', 'minor', 'model', 'moist', 'money', 'month',
  'moral', 'motor', 'mound', 'mount', 'mouse', 'mouth', 'mover', 'music',
  'naval', 'nerve', 'never', 'newer', 'niece', 'night', 'noble', 'noise',
  'north', 'novel', 'nurse', 'ocean', 'offer', 'often', 'olive', 'onion',
  'order', 'organ', 'other', 'ought', 'ounce', 'owner', 'paint', 'panel',
  'paper', 'party', 'pasta', 'paste', 'patch', 'pause', 'peace', 'peach',
  'pearl', 'pedal', 'penny', 'perch', 'phase', 'phone', 'piano', 'piece',
  'pilot', 'pinch', 'pitch', 'pixel', 'place', 'plain', 'plane', 'plant',
  'plate', 'plaza', 'plead', 'plumb', 'plump', 'point', 'polar', 'porch',
  'pound', 'power', 'press', 'price', 'pride', 'prime', 'print', 'prior',
  'prize', 'proof', 'proud', 'prove', 'pulse', 'punch', 'pupil', 'purse',
  'queen', 'quest', 'quick', 'quiet', 'quilt', 'quite', 'radar', 'radio',
  'raise', 'rally', 'ranch', 'range', 'rapid', 'razor', 'reach', 'react',
  'ready', 'realm', 'rebel', 'refer', 'relax', 'relay', 'remit', 'renew',
  'reply', 'ridge', 'rifle', 'right', 'rigid', 'rinse', 'ripen', 'risen',
  'river', 'roast', 'robot', 'rocky', 'roger', 'rouge', 'rough', 'round',
  'route', 'royal', 'rural', 'saint', 'salad', 'sandy', 'sauce', 'scale',
  'scarf', 'scene', 'scent', 'scope', 'score', 'scout', 'scrap', 'sense',
  'serve', 'seven', 'shade', 'shady', 'shaft', 'shake', 'shall', 'shame',
  'shape', 'share', 'shark', 'sharp', 'shawl', 'shear', 'sheep', 'sheet',
  'shelf', 'shell', 'shift', 'shine', 'shiny', 'shirt', 'shock', 'shone',
  'shook', 'shore', 'short', 'shout', 'shown', 'sight', 'silly', 'since',
  'siren', 'sixth', 'sixty', 'skate', 'skill', 'skirt', 'skull', 'slack',
  'slate', 'slave', 'sleep', 'slice', 'slide', 'slope', 'small', 'smart',
  'smell', 'smile', 'smoke', 'snack', 'snail', 'snake', 'sneak', 'snowy',
  'solar', 'solid', 'solve', 'sorry', 'sound', 'south', 'space', 'spare',
  'spark', 'speak', 'spear', 'speed', 'spell', 'spend', 'spice', 'spike',
  'spine', 'spite', 'split', 'spoke', 'spoon', 'sport', 'spray', 'squad',
  'stack', 'staff', 'stage', 'stain', 'stair', 'stake', 'stale', 'stalk',
  'stamp', 'stand', 'stare', 'start', 'state', 'steak', 'steal', 'steam',
  'steel', 'steep', 'steer', 'stern', 'stick', 'stiff', 'still', 'sting',
  'stock', 'stone', 'stood', 'stool', 'store', 'storm', 'story', 'stout',
  'stove', 'straw', 'strip', 'study', 'stuff', 'stump', 'stung', 'style',
  'sugar', 'sunny', 'super', 'surge', 'swamp', 'swarm', 'swear', 'sweat',
  'sweep', 'sweet', 'swept', 'swift', 'swing', 'sword', 'syrup', 'table',
  'taken', 'tally', 'taste', 'teach', 'teeth', 'tempo', 'tenth', 'thank',
  'their', 'theme', 'there', 'these', 'thick', 'thief', 'thing', 'think',
  'third', 'those', 'three', 'threw', 'throw', 'thumb', 'tiger', 'tight',
  'timer', 'tired', 'title', 'toast', 'today', 'token', 'tooth', 'topic',
  'torch', 'total', 'touch', 'tough', 'towel', 'tower', 'trace', 'track',
  'trade', 'trail', 'train', 'trait', 'tramp', 'trash', 'tread', 'treat',
  'trend', 'trial', 'tribe', 'trick', 'tried', 'troop', 'trout', 'truce',
  'truck', 'truly', 'trunk', 'trust', 'truth', 'tulip', 'tumor', 'tunic',
  'twice', 'twist', 'ultra', 'uncle', 'under', 'undue', 'union', 'unite',
  'unity', 'until', 'upper', 'upset', 'urban', 'usage', 'usher', 'usual',
  'vague', 'valet', 'valid', 'value', 'valve', 'vapor', 'vault', 'venom',
  'verse', 'video', 'vigor', 'villa', 'vinyl', 'viola', 'viper', 'virus',
  'visit', 'vital', 'vivid', 'vocal', 'voice', 'wagon', 'waist', 'waste',
  'watch', 'water', 'weary', 'weave', 'wedge', 'weigh', 'weird', 'whale',
  'wharf', 'wheat', 'wheel', 'where', 'which', 'while', 'white', 'whole',
  'whose', 'widen', 'wider', 'width', 'windy', 'witch', 'woman', 'women',
  'world', 'worry', 'worse', 'worst', 'worth', 'would', 'wound', 'woven',
  'wrist', 'write', 'wrong', 'wrote', 'yeast', 'yield', 'young', 'youth',
  'zebra',
  // 6-8 letter (a smaller sampling — longer words score higher when found)
  'action', 'animal', 'answer', 'artist', 'autumn', 'basket', 'beauty',
  'become', 'before', 'behind', 'better', 'branch', 'breath', 'bright',
  'button', 'camera', 'candle', 'carbon', 'castle', 'change', 'cheese',
  'circle', 'clever', 'closet', 'copper', 'corner', 'cotton', 'course',
  'crayon', 'dagger', 'danger', 'desert', 'design', 'detail', 'dinner',
  'doctor', 'dragon', 'engine', 'expert', 'family', 'famous',
  'farmer', 'father', 'figure', 'finger', 'flower', 'forest', 'friend',
  'frozen', 'future', 'garden', 'gather', 'golden', 'ground', 'guitar',
  'hammer', 'handle', 'hidden', 'honest', 'hunter', 'island', 'jacket',
  'jungle', 'kitten', 'ladder', 'lawyer', 'letter', 'listen',
  'little', 'locker', 'magnet', 'marble', 'market', 'meadow', 'melody',
  'memory', 'method', 'middle', 'minute', 'mirror', 'monkey', 'mother',
  'nature', 'needle', 'orange', 'orchid', 'packet', 'palace', 'parcel',
  'pardon', 'parent', 'pencil', 'people', 'person', 'pepper', 'picnic',
  'planet', 'plaster', 'pocket', 'poison', 'polish', 'potato', 'powder',
  'praise', 'prince', 'prison', 'purple', 'rabbit', 'ribbon', 'rocket',
  'saddle', 'safari', 'salmon', 'school', 'season', 'shadow', 'shovel',
  'signal', 'silver', 'simple', 'singer', 'sister', 'smooth', 'spider',
  'spring', 'square', 'stable', 'statue', 'stream', 'street', 'strong',
  'summer', 'sunset', 'switch', 'system', 'tablet', 'talent', 'temple',
  'thread', 'throne', 'ticket', 'tissue', 'tomato', 'travel', 'tunnel',
  'turtle', 'valley', 'velvet', 'violet', 'walnut', 'window', 'winter',
  'wisdom', 'wonder', 'wooden', 'yellow',
  'anthem', 'antler', 'beacon', 'bakery', 'balcony', 'blanket',
  'captain', 'chimney', 'compass', 'diamond', 'evening', 'feather', 'freedom',
  'gallery', 'harvest', 'journey', 'kitchen', 'library', 'machine', 'morning',
  'network', 'october', 'passage', 'picture', 'popcorn', 'problem', 'promise',
  'quarter', 'rainbow', 'sandwich', 'science', 'silence', 'stadium', 'thunder',
  'tornado', 'trumpet', 'village', 'volcano', 'weather', 'whisper',
  'mountain', 'notebook', 'sunshine', 'elephant', 'daughter', 'hospital',
  'birthday', 'campfire', 'daylight', 'doorstep', 'starfish', 'treasure',
]);

const GRID_SIZE = 4;

// Build the seeded grid. Pure function of the seed string (and size), so any two
// clients drawing the same seed get an identical grid. Shuffles the Boggle dice
// deterministically and rolls one face from each with the seeded rng, matching
// real Boggle: sixteen dice, one letter each, then laid out row-major.
export function buildGrid(seed, size = GRID_SIZE) {
  const rng = seededRng(`wordhunt:${seed}`);
  const cells = size * size;
  // Deterministic Fisher–Yates over a copy of the dice, then roll each.
  const dice = DICE.slice();
  for (let i = dice.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [dice[i], dice[j]] = [dice[j], dice[i]];
  }
  const flat = [];
  for (let i = 0; i < cells; i++) {
    const die = dice[i % dice.length];
    flat.push(die[Math.floor(rng() * die.length)].toUpperCase());
  }
  const grid = [];
  for (let r = 0; r < size; r++) grid.push(flat.slice(r * size, r * size + size));
  return grid;
}

// 8-directional adjacency depth-first search: does `word` trace a real path on
// `grid`, using each cell at most once? Letters are matched case-insensitively.
export function gridHasPath(grid, word) {
  if (!Array.isArray(grid) || !grid.length || typeof word !== 'string') return false;
  const target = word.toLowerCase();
  if (!target.length) return false;
  const rows = grid.length;
  const cols = grid[0].length;
  const at = (r, c) => String(grid[r][c]).toLowerCase();
  const seen = Array.from({ length: rows }, () => new Array(cols).fill(false));

  const dfs = (r, c, idx) => {
    if (at(r, c) !== target[idx]) return false;
    if (idx === target.length - 1) return true;
    seen[r][c] = true;
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue;
        const nr = r + dr;
        const nc = c + dc;
        if (nr < 0 || nr >= rows || nc < 0 || nc >= cols || seen[nr][nc]) continue;
        if (dfs(nr, nc, idx + 1)) { seen[r][c] = false; return true; }
      }
    }
    seen[r][c] = false;
    return false;
  };

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (dfs(r, c, 0)) return true;
    }
  }
  return false;
}

// Length-weighted score for a single accepted word. Longer words are worth
// strictly more so a five-letter find beats a three-letter one. Classic Boggle
// tiering, floored so any accepted (length>=3) word scores at least 1.
export function scoreWord(word) {
  const n = typeof word === 'string' ? word.length : 0;
  if (n < 3) return 0;
  if (n === 3) return 1;
  if (n === 4) return 2;
  if (n === 5) return 4;
  if (n === 6) return 6;
  if (n === 7) return 9;
  return 11; // 8+
}

// Test-harness / bot helper: find real, scoring words on a grid. The browser
// never imports this — a client discovers words by playing. Walks the WORDLIST
// and keeps entries whose length fits the board and that actually path on it.
// Returns up to `max` words, longest-first so the harness earns a real score.
export function solveGrid(grid, max = 40) {
  if (!Array.isArray(grid) || !grid.length) return [];
  const area = grid.length * grid[0].length;
  const found = [];
  for (const word of WORDLIST) {
    if (word.length < 3 || word.length > area) continue;
    if (gridHasPath(grid, word)) found.push(word);
  }
  found.sort((a, b) => b.length - a.length);
  return found.slice(0, max);
}
