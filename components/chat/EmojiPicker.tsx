'use client';

/**
 * EmojiPicker - Emoji picker popover component
 * 
 * Replicates AngularJS cnv-emoji-popover directive exactly
 * Matches AngularJS structure:
 * - Search bar with icon and clear button
 * - Emoji container (249px height) with scrollable categories
 * - Category toolbar at bottom
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import './EmojiPicker.css';

interface EmojiPickerProps {
  onEmojiSelect: (unicode: string) => void;
  disabled?: boolean;
}

interface Emoji {
  unicode: string;
  short_name: string;
  title?: string;
}

interface EmojiCategory {
  category: string;
  emojisList: Emoji[];
}

// Frequently Used emojis - matches AngularJS
const FREQUENTLY_USED: Emoji[] = [
  { unicode: '👍', short_name: 'thumbsup', title: 'Thumbs Up' },
  { unicode: '😀', short_name: 'grinning', title: 'Grinning Face' },
  { unicode: '🎉', short_name: 'tada', title: 'Party Popper' },
  { unicode: '👏', short_name: 'clap', title: 'Clapping Hands' },
  { unicode: '😊', short_name: 'blush', title: 'Smiling Face with Smiling Eyes' },
  { unicode: '😍', short_name: 'heart_eyes', title: 'Heart Eyes' },
  { unicode: '❤️', short_name: 'heart', title: 'Red Heart' },
  { unicode: '⭐', short_name: 'star', title: 'Star' },
  { unicode: '🎂', short_name: 'birthday', title: 'Birthday Cake' },
  { unicode: '🌸', short_name: 'cherry_blossom', title: 'Cherry Blossom' },
  { unicode: '💗', short_name: 'heartpulse', title: 'Growing Heart' },
];

// People category emojis - matches AngularJS
const PEOPLE_CATEGORY: Emoji[] = [
  { unicode: '😀', short_name: 'grinning', title: 'Grinning Face' },
  { unicode: '😃', short_name: 'smiley', title: 'Smiling Face with Open Mouth' },
  { unicode: '😄', short_name: 'smile', title: 'Smiling Face with Open Mouth and Smiling Eyes' },
  { unicode: '😁', short_name: 'grin', title: 'Beaming Face with Smiling Eyes' },
  { unicode: '😆', short_name: 'laughing', title: 'Grinning Squinting Face' },
  { unicode: '😅', short_name: 'sweat_smile', title: 'Grinning Face with Sweat' },
  { unicode: '🤣', short_name: 'rofl', title: 'Rolling on the Floor Laughing' },
  { unicode: '😂', short_name: 'joy', title: 'Face with Tears of Joy' },
  { unicode: '🙂', short_name: 'slightly_smiling_face', title: 'Slightly Smiling Face' },
  { unicode: '🙃', short_name: 'upside_down_face', title: 'Upside-Down Face' },
  { unicode: '😉', short_name: 'wink', title: 'Winking Face' },
  { unicode: '😊', short_name: 'blush', title: 'Smiling Face with Smiling Eyes' },
  { unicode: '😇', short_name: 'innocent', title: 'Smiling Face with Halo' },
  { unicode: '🥰', short_name: 'smiling_face_with_three_hearts', title: 'Smiling Face with Hearts' },
  { unicode: '😍', short_name: 'heart_eyes', title: 'Heart Eyes' },
  { unicode: '🤩', short_name: 'star_struck', title: 'Star-Struck' },
  { unicode: '😘', short_name: 'kissing_heart', title: 'Face Blowing a Kiss' },
  { unicode: '😗', short_name: 'kissing', title: 'Kissing Face' },
  { unicode: '😚', short_name: 'kissing_closed_eyes', title: 'Kissing Face with Closed Eyes' },
  { unicode: '😙', short_name: 'kissing_smiling_eyes', title: 'Kissing Face with Smiling Eyes' },
  { unicode: '😋', short_name: 'yum', title: 'Face Savoring Food' },
  { unicode: '😛', short_name: 'stuck_out_tongue', title: 'Face with Tongue' },
  { unicode: '😜', short_name: 'stuck_out_tongue_winking_eye', title: 'Winking Face with Tongue' },
  { unicode: '🤪', short_name: 'zany_face', title: 'Zany Face' },
  { unicode: '😝', short_name: 'stuck_out_tongue_closed_eyes', title: 'Squinting Face with Tongue' },
  { unicode: '🤑', short_name: 'money_mouth_face', title: 'Money-Mouth Face' },
  { unicode: '🤗', short_name: 'hugs', title: 'Hugging Face' },
  { unicode: '🤭', short_name: 'hand_over_mouth', title: 'Face with Hand Over Mouth' },
  { unicode: '🤫', short_name: 'shushing_face', title: 'Shushing Face' },
  { unicode: '🤔', short_name: 'thinking', title: 'Thinking Face' },
  { unicode: '🤐', short_name: 'zipper_mouth_face', title: 'Zipper-Mouth Face' },
  { unicode: '🤨', short_name: 'raised_eyebrow', title: 'Face with Raised Eyebrow' },
  { unicode: '😐', short_name: 'neutral_face', title: 'Neutral Face' },
  { unicode: '😑', short_name: 'expressionless', title: 'Expressionless Face' },
  { unicode: '😶', short_name: 'no_mouth', title: 'Face Without Mouth' },
  { unicode: '😏', short_name: 'smirk', title: 'Smirking Face' },
  { unicode: '😒', short_name: 'unamused', title: 'Unamused Face' },
  { unicode: '🙄', short_name: 'roll_eyes', title: 'Face with Rolling Eyes' },
  { unicode: '😬', short_name: 'grimacing', title: 'Grimacing Face' },
  { unicode: '🤥', short_name: 'lying_face', title: 'Lying Face' },
  { unicode: '😌', short_name: 'relieved', title: 'Relieved Face' },
  { unicode: '😔', short_name: 'pensive', title: 'Pensive Face' },
  { unicode: '😪', short_name: 'sleepy', title: 'Sleepy Face' },
  { unicode: '🤤', short_name: 'drooling_face', title: 'Drooling Face' },
  { unicode: '😴', short_name: 'sleeping', title: 'Sleeping Face' },
  { unicode: '😷', short_name: 'mask', title: 'Face with Medical Mask' },
  { unicode: '🤒', short_name: 'face_with_thermometer', title: 'Face with Thermometer' },
  { unicode: '🤕', short_name: 'face_with_head_bandage', title: 'Face with Head-Bandage' },
  { unicode: '🤢', short_name: 'nauseated_face', title: 'Nauseated Face' },
  { unicode: '🤮', short_name: 'vomiting_face', title: 'Face Vomiting' },
  { unicode: '🤧', short_name: 'sneezing_face', title: 'Sneezing Face' },
  { unicode: '🥵', short_name: 'hot_face', title: 'Hot Face' },
  { unicode: '🥶', short_name: 'cold_face', title: 'Cold Face' },
  { unicode: '🥴', short_name: 'woozy_face', title: 'Woozy Face' },
  { unicode: '😵', short_name: 'dizzy_face', title: 'Dizzy Face' },
  { unicode: '🤯', short_name: 'exploding_head', title: 'Exploding Head' },
  { unicode: '🤠', short_name: 'cowboy_hat_face', title: 'Cowboy Hat Face' },
  { unicode: '🥳', short_name: 'partying_face', title: 'Partying Face' },
  { unicode: '😎', short_name: 'sunglasses', title: 'Smiling Face with Sunglasses' },
  { unicode: '🤓', short_name: 'nerd_face', title: 'Nerd Face' },
  { unicode: '🧐', short_name: 'monocle_face', title: 'Face with Monocle' },
  { unicode: '😕', short_name: 'confused', title: 'Confused Face' },
  { unicode: '😟', short_name: 'worried', title: 'Worried Face' },
  { unicode: '🙁', short_name: 'slightly_frowning_face', title: 'Slightly Frowning Face' },
  { unicode: '😮', short_name: 'open_mouth', title: 'Face with Open Mouth' },
  { unicode: '😯', short_name: 'hushed', title: 'Hushed Face' },
  { unicode: '😲', short_name: 'astonished', title: 'Astonished Face' },
  { unicode: '😳', short_name: 'flushed', title: 'Flushed Face' },
  { unicode: '🥺', short_name: 'pleading_face', title: 'Pleading Face' },
  { unicode: '😦', short_name: 'frowning', title: 'Frowning Face with Open Mouth' },
  { unicode: '😧', short_name: 'anguished', title: 'Anguished Face' },
  { unicode: '😨', short_name: 'fearful', title: 'Fearful Face' },
  { unicode: '😰', short_name: 'cold_sweat', title: 'Anxious Face with Sweat' },
  { unicode: '😥', short_name: 'disappointed_relieved', title: 'Sad but Relieved Face' },
  { unicode: '😢', short_name: 'cry', title: 'Crying Face' },
  { unicode: '😭', short_name: 'sob', title: 'Loudly Crying Face' },
  { unicode: '😱', short_name: 'scream', title: 'Face Screaming in Fear' },
  { unicode: '😖', short_name: 'confounded', title: 'Confounded Face' },
  { unicode: '😣', short_name: 'persevere', title: 'Persevering Face' },
  { unicode: '😞', short_name: 'disappointed', title: 'Disappointed Face' },
  { unicode: '😓', short_name: 'sweat', title: 'Downcast Face with Sweat' },
  { unicode: '😩', short_name: 'weary', title: 'Weary Face' },
  { unicode: '😫', short_name: 'tired_face', title: 'Tired Face' },
  { unicode: '🥱', short_name: 'yawning_face', title: 'Yawning Face' },
  { unicode: '😤', short_name: 'triumph', title: 'Face with Steam from Nose' },
  { unicode: '😡', short_name: 'rage', title: 'Pouting Face' },
  { unicode: '😠', short_name: 'angry', title: 'Angry Face' },
  { unicode: '🤬', short_name: 'cursing_face', title: 'Face with Symbols Over Mouth' },
  { unicode: '😈', short_name: 'smiling_imp', title: 'Smiling Face with Horns' },
  { unicode: '👿', short_name: 'imp', title: 'Angry Face with Horns' },
  { unicode: '💀', short_name: 'skull', title: 'Skull' },
  { unicode: '☠️', short_name: 'skull_and_crossbones', title: 'Skull and Crossbones' },
  { unicode: '💩', short_name: 'poop', title: 'Pile of Poo' },
  { unicode: '🤡', short_name: 'clown_face', title: 'Clown Face' },
  { unicode: '👹', short_name: 'japanese_ogre', title: 'Ogre' },
  { unicode: '👺', short_name: 'japanese_goblin', title: 'Goblin' },
  { unicode: '👻', short_name: 'ghost', title: 'Ghost' },
  { unicode: '👽', short_name: 'alien', title: 'Alien' },
  { unicode: '👾', short_name: 'space_invader', title: 'Alien Monster' },
  { unicode: '🤖', short_name: 'robot', title: 'Robot Face' },
  { unicode: '😺', short_name: 'smiley_cat', title: 'Grinning Cat Face' },
  { unicode: '😸', short_name: 'smile_cat', title: 'Grinning Cat Face with Smiling Eyes' },
  { unicode: '😹', short_name: 'joy_cat', title: 'Cat Face with Tears of Joy' },
  { unicode: '😻', short_name: 'heart_eyes_cat', title: 'Smiling Cat Face with Heart-Eyes' },
  { unicode: '😼', short_name: 'smirk_cat', title: 'Cat Face with Wry Smile' },
  { unicode: '😽', short_name: 'kissing_cat', title: 'Kissing Cat Face' },
  { unicode: '🙀', short_name: 'scream_cat', title: 'Weary Cat Face' },
  { unicode: '😿', short_name: 'crying_cat_face', title: 'Crying Cat Face' },
  { unicode: '😾', short_name: 'pouting_cat', title: 'Pouting Cat Face' },
];

// Nature category emojis
const NATURE_CATEGORY: Emoji[] = [
  { unicode: '🐶', short_name: 'dog', title: 'Dog Face' },
  { unicode: '🐱', short_name: 'cat', title: 'Cat Face' },
  { unicode: '🐭', short_name: 'mouse', title: 'Mouse Face' },
  { unicode: '🐹', short_name: 'hamster', title: 'Hamster Face' },
  { unicode: '🐰', short_name: 'rabbit', title: 'Rabbit Face' },
  { unicode: '🦊', short_name: 'fox_face', title: 'Fox Face' },
  { unicode: '🐻', short_name: 'bear', title: 'Bear Face' },
  { unicode: '🐼', short_name: 'panda_face', title: 'Panda Face' },
  { unicode: '🐨', short_name: 'koala', title: 'Koala' },
  { unicode: '🐯', short_name: 'tiger', title: 'Tiger Face' },
  { unicode: '🦁', short_name: 'lion_face', title: 'Lion Face' },
  { unicode: '🐮', short_name: 'cow', title: 'Cow Face' },
  { unicode: '🐷', short_name: 'pig', title: 'Pig Face' },
  { unicode: '🐸', short_name: 'frog', title: 'Frog' },
  { unicode: '🐵', short_name: 'monkey_face', title: 'Monkey Face' },
  { unicode: '🐔', short_name: 'chicken', title: 'Chicken' },
  { unicode: '🐧', short_name: 'penguin', title: 'Penguin' },
  { unicode: '🐦', short_name: 'bird', title: 'Bird' },
  { unicode: '🐤', short_name: 'baby_chick', title: 'Baby Chick' },
  { unicode: '🦆', short_name: 'duck', title: 'Duck' },
  { unicode: '🦅', short_name: 'eagle', title: 'Eagle' },
  { unicode: '🦉', short_name: 'owl', title: 'Owl' },
  { unicode: '🦇', short_name: 'bat', title: 'Bat' },
  { unicode: '🐺', short_name: 'wolf', title: 'Wolf Face' },
  { unicode: '🐗', short_name: 'boar', title: 'Boar' },
  { unicode: '🐴', short_name: 'horse', title: 'Horse Face' },
  { unicode: '🦄', short_name: 'unicorn_face', title: 'Unicorn Face' },
  { unicode: '🐝', short_name: 'bee', title: 'Honeybee' },
  { unicode: '🐛', short_name: 'bug', title: 'Bug' },
  { unicode: '🦋', short_name: 'butterfly', title: 'Butterfly' },
  { unicode: '🐌', short_name: 'snail', title: 'Snail' },
  { unicode: '🐞', short_name: 'beetle', title: 'Lady Beetle' },
  { unicode: '🐜', short_name: 'ant', title: 'Ant' },
  { unicode: '🦟', short_name: 'mosquito', title: 'Mosquito' },
  { unicode: '🦗', short_name: 'cricket', title: 'Cricket' },
  { unicode: '🕷️', short_name: 'spider', title: 'Spider' },
  { unicode: '🦂', short_name: 'scorpion', title: 'Scorpion' },
  { unicode: '🐢', short_name: 'turtle', title: 'Turtle' },
  { unicode: '🐍', short_name: 'snake', title: 'Snake' },
  { unicode: '🦎', short_name: 'lizard', title: 'Lizard' },
  { unicode: '🦖', short_name: 't_rex', title: 'T-Rex' },
  { unicode: '🦕', short_name: 'sauropod', title: 'Sauropod' },
  { unicode: '🐙', short_name: 'octopus', title: 'Octopus' },
  { unicode: '🦑', short_name: 'squid', title: 'Squid' },
  { unicode: '🦐', short_name: 'shrimp', title: 'Shrimp' },
  { unicode: '🦞', short_name: 'lobster', title: 'Lobster' },
  { unicode: '🦀', short_name: 'crab', title: 'Crab' },
  { unicode: '🐡', short_name: 'blowfish', title: 'Blowfish' },
  { unicode: '🐠', short_name: 'tropical_fish', title: 'Tropical Fish' },
  { unicode: '🐟', short_name: 'fish', title: 'Fish' },
  { unicode: '🐬', short_name: 'dolphin', title: 'Dolphin' },
  { unicode: '🐳', short_name: 'whale', title: 'Spouting Whale' },
  { unicode: '🐋', short_name: 'whale2', title: 'Whale' },
  { unicode: '🦈', short_name: 'shark', title: 'Shark' },
  { unicode: '🐊', short_name: 'crocodile', title: 'Crocodile' },
  { unicode: '🐅', short_name: 'tiger2', title: 'Tiger' },
  { unicode: '🐆', short_name: 'leopard', title: 'Leopard' },
  { unicode: '🦓', short_name: 'zebra_face', title: 'Zebra Face' },
  { unicode: '🦍', short_name: 'gorilla', title: 'Gorilla' },
  { unicode: '🦧', short_name: 'orangutan', title: 'Orangutan' },
  { unicode: '🐘', short_name: 'elephant', title: 'Elephant' },
  { unicode: '🦛', short_name: 'hippopotamus', title: 'Hippopotamus' },
  { unicode: '🦏', short_name: 'rhinoceros', title: 'Rhinoceros' },
  { unicode: '🐪', short_name: 'dromedary_camel', title: 'Dromedary Camel' },
  { unicode: '🐫', short_name: 'camel', title: 'Bactrian Camel' },
  { unicode: '🦒', short_name: 'giraffe_face', title: 'Giraffe Face' },
  { unicode: '🦘', short_name: 'kangaroo', title: 'Kangaroo' },
  { unicode: '🦡', short_name: 'badger', title: 'Badger' },
  { unicode: '🐃', short_name: 'water_buffalo', title: 'Water Buffalo' },
  { unicode: '🐂', short_name: 'ox', title: 'Ox' },
  { unicode: '🐄', short_name: 'cow2', title: 'Cow' },
  { unicode: '🐖', short_name: 'pig2', title: 'Pig' },
  { unicode: '🐏', short_name: 'ram', title: 'Ram' },
  { unicode: '🐑', short_name: 'sheep', title: 'Ewe' },
  { unicode: '🐐', short_name: 'goat', title: 'Goat' },
  { unicode: '🦌', short_name: 'deer', title: 'Deer' },
  { unicode: '🐕', short_name: 'dog2', title: 'Dog' },
  { unicode: '🐩', short_name: 'poodle', title: 'Poodle' },
  { unicode: '🐈', short_name: 'cat2', title: 'Cat' },
  { unicode: '🐓', short_name: 'rooster', title: 'Rooster' },
  { unicode: '🦃', short_name: 'turkey', title: 'Turkey' },
  { unicode: '🦚', short_name: 'peacock', title: 'Peacock' },
  { unicode: '🦜', short_name: 'parrot', title: 'Parrot' },
  { unicode: '🦢', short_name: 'swan', title: 'Swan' },
  { unicode: '🦝', short_name: 'raccoon', title: 'Raccoon' },
  { unicode: '🐾', short_name: 'feet', title: 'Paw Prints' },
  { unicode: '🌵', short_name: 'cactus', title: 'Cactus' },
  { unicode: '🌲', short_name: 'evergreen_tree', title: 'Evergreen Tree' },
  { unicode: '🌳', short_name: 'deciduous_tree', title: 'Deciduous Tree' },
  { unicode: '🌴', short_name: 'palm_tree', title: 'Palm Tree' },
  { unicode: '🌱', short_name: 'seedling', title: 'Seedling' },
  { unicode: '🌿', short_name: 'herb', title: 'Herb' },
  { unicode: '☘️', short_name: 'shamrock', title: 'Shamrock' },
  { unicode: '🍀', short_name: 'four_leaf_clover', title: 'Four Leaf Clover' },
  { unicode: '🍃', short_name: 'leaves', title: 'Leaf Fluttering in Wind' },
  { unicode: '🍂', short_name: 'fallen_leaf', title: 'Fallen Leaf' },
  { unicode: '🍁', short_name: 'maple_leaf', title: 'Maple Leaf' },
  { unicode: '🌾', short_name: 'ear_of_rice', title: 'Sheaf of Rice' },
  { unicode: '🌺', short_name: 'hibiscus', title: 'Hibiscus' },
  { unicode: '🌻', short_name: 'sunflower', title: 'Sunflower' },
  { unicode: '🌹', short_name: 'rose', title: 'Rose' },
  { unicode: '🥀', short_name: 'wilted_flower', title: 'Wilted Flower' },
  { unicode: '🌷', short_name: 'tulip', title: 'Tulip' },
  { unicode: '🌼', short_name: 'blossom', title: 'Blossom' },
  { unicode: '🌸', short_name: 'cherry_blossom', title: 'Cherry Blossom' },
  { unicode: '💐', short_name: 'bouquet', title: 'Bouquet' },
  { unicode: '🌍', short_name: 'earth_africa', title: 'Globe Showing Europe-Africa' },
  { unicode: '🌎', short_name: 'earth_americas', title: 'Globe Showing Americas' },
  { unicode: '🌏', short_name: 'earth_asia', title: 'Globe Showing Asia-Australia' },
  { unicode: '🌕', short_name: 'full_moon', title: 'Full Moon' },
  { unicode: '🌖', short_name: 'waning_gibbous_moon', title: 'Waning Gibbous Moon' },
  { unicode: '🌗', short_name: 'last_quarter_moon', title: 'Last Quarter Moon' },
  { unicode: '🌘', short_name: 'waning_crescent_moon', title: 'Waning Crescent Moon' },
  { unicode: '🌑', short_name: 'new_moon', title: 'New Moon' },
  { unicode: '🌒', short_name: 'waxing_crescent_moon', title: 'Waxing Crescent Moon' },
  { unicode: '🌓', short_name: 'first_quarter_moon', title: 'First Quarter Moon' },
  { unicode: '🌔', short_name: 'waxing_gibbous_moon', title: 'Waxing Gibbous Moon' },
  { unicode: '🌙', short_name: 'crescent_moon', title: 'Crescent Moon' },
  { unicode: '🌚', short_name: 'new_moon_with_face', title: 'New Moon Face' },
  { unicode: '🌛', short_name: 'first_quarter_moon_with_face', title: 'First Quarter Moon Face' },
  { unicode: '🌜', short_name: 'last_quarter_moon_with_face', title: 'Last Quarter Moon Face' },
  { unicode: '🌡️', short_name: 'thermometer', title: 'Thermometer' },
  { unicode: '☀️', short_name: 'sunny', title: 'Sun' },
  { unicode: '🌝', short_name: 'full_moon_with_face', title: 'Full Moon Face' },
  { unicode: '🌞', short_name: 'sun_with_face', title: 'Sun with Face' },
  { unicode: '⭐', short_name: 'star', title: 'Star' },
  { unicode: '🌟', short_name: 'star2', title: 'Glowing Star' },
  { unicode: '🌠', short_name: 'stars', title: 'Shooting Star' },
  { unicode: '☁️', short_name: 'cloud', title: 'Cloud' },
  { unicode: '⛅', short_name: 'partly_sunny', title: 'Sun Behind Cloud' },
  { unicode: '⛈️', short_name: 'thunder_cloud_and_rain', title: 'Cloud with Lightning and Rain' },
  { unicode: '🌤️', short_name: 'mostly_sunny', title: 'Sun Behind Small Cloud' },
  { unicode: '🌥️', short_name: 'barely_sunny', title: 'Sun Behind Large Cloud' },
  { unicode: '🌦️', short_name: 'partly_sunny_rain', title: 'Sun Behind Rain Cloud' },
  { unicode: '🌧️', short_name: 'cloud_with_rain', title: 'Cloud with Rain' },
  { unicode: '🌨️', short_name: 'cloud_with_snow', title: 'Cloud with Snow' },
  { unicode: '🌩️', short_name: 'cloud_with_lightning', title: 'Cloud with Lightning' },
  { unicode: '🌪️', short_name: 'tornado', title: 'Tornado' },
  { unicode: '🌫️', short_name: 'fog', title: 'Fog' },
  { unicode: '🌬️', short_name: 'wind_blowing_face', title: 'Wind Face' },
  { unicode: '🌀', short_name: 'cyclone', title: 'Cyclone' },
  { unicode: '🌈', short_name: 'rainbow', title: 'Rainbow' },
  { unicode: '☂️', short_name: 'umbrella', title: 'Umbrella' },
  { unicode: '☔', short_name: 'umbrella_with_rain_drops', title: 'Umbrella with Rain Drops' },
  { unicode: '☃️', short_name: 'snowman_with_snow', title: 'Snowman' },
  { unicode: '⛄', short_name: 'snowman', title: 'Snowman Without Snow' },
  { unicode: '❄️', short_name: 'snowflake', title: 'Snowflake' },
  { unicode: '☄️', short_name: 'comet', title: 'Comet' },
  { unicode: '💧', short_name: 'droplet', title: 'Droplet' },
  { unicode: '🔥', short_name: 'fire', title: 'Fire' },
];

// Food category emojis
const FOOD_CATEGORY: Emoji[] = [
  { unicode: '🍏', short_name: 'green_apple', title: 'Green Apple' },
  { unicode: '🍎', short_name: 'apple', title: 'Red Apple' },
  { unicode: '🍐', short_name: 'pear', title: 'Pear' },
  { unicode: '🍊', short_name: 'tangerine', title: 'Tangerine' },
  { unicode: '🍋', short_name: 'lemon', title: 'Lemon' },
  { unicode: '🍌', short_name: 'banana', title: 'Banana' },
  { unicode: '🍉', short_name: 'watermelon', title: 'Watermelon' },
  { unicode: '🍇', short_name: 'grapes', title: 'Grapes' },
  { unicode: '🍓', short_name: 'strawberry', title: 'Strawberry' },
  { unicode: '🍈', short_name: 'melon', title: 'Melon' },
  { unicode: '🍒', short_name: 'cherries', title: 'Cherries' },
  { unicode: '🍑', short_name: 'peach', title: 'Peach' },
  { unicode: '🥭', short_name: 'mango', title: 'Mango' },
  { unicode: '🍍', short_name: 'pineapple', title: 'Pineapple' },
  { unicode: '🥥', short_name: 'coconut', title: 'Coconut' },
  { unicode: '🥝', short_name: 'kiwi_fruit', title: 'Kiwi Fruit' },
  { unicode: '🍅', short_name: 'tomato', title: 'Tomato' },
  { unicode: '🍆', short_name: 'eggplant', title: 'Eggplant' },
  { unicode: '🥑', short_name: 'avocado', title: 'Avocado' },
  { unicode: '🥦', short_name: 'broccoli', title: 'Broccoli' },
  { unicode: '🥬', short_name: 'leafy_greens', title: 'Leafy Greens' },
  { unicode: '🥒', short_name: 'cucumber', title: 'Cucumber' },
  { unicode: '🌶️', short_name: 'hot_pepper', title: 'Hot Pepper' },
  { unicode: '🌽', short_name: 'corn', title: 'Ear of Corn' },
  { unicode: '🥕', short_name: 'carrot', title: 'Carrot' },
  { unicode: '🥔', short_name: 'potato', title: 'Potato' },
  { unicode: '🍠', short_name: 'sweet_potato', title: 'Roasted Sweet Potato' },
  { unicode: '🥜', short_name: 'peanuts', title: 'Peanuts' },
  { unicode: '🌰', short_name: 'chestnut', title: 'Chestnut' },
  { unicode: '🍞', short_name: 'bread', title: 'Bread' },
  { unicode: '🥐', short_name: 'croissant', title: 'Croissant' },
  { unicode: '🥖', short_name: 'baguette_bread', title: 'Baguette Bread' },
  { unicode: '🥨', short_name: 'pretzel', title: 'Pretzel' },
  { unicode: '🥞', short_name: 'pancakes', title: 'Pancakes' },
  { unicode: '🧀', short_name: 'cheese', title: 'Cheese Wedge' },
  { unicode: '🍖', short_name: 'meat_on_bone', title: 'Meat on Bone' },
  { unicode: '🍗', short_name: 'poultry_leg', title: 'Poultry Leg' },
  { unicode: '🥩', short_name: 'cut_of_meat', title: 'Cut of Meat' },
  { unicode: '🥓', short_name: 'bacon', title: 'Bacon' },
  { unicode: '🍔', short_name: 'hamburger', title: 'Hamburger' },
  { unicode: '🍟', short_name: 'fries', title: 'French Fries' },
  { unicode: '🍕', short_name: 'pizza', title: 'Pizza' },
  { unicode: '🌭', short_name: 'hotdog', title: 'Hot Dog' },
  { unicode: '🥪', short_name: 'sandwich', title: 'Sandwich' },
  { unicode: '🌮', short_name: 'taco', title: 'Taco' },
  { unicode: '🌯', short_name: 'burrito', title: 'Burrito' },
  { unicode: '🥙', short_name: 'stuffed_flatbread', title: 'Stuffed Flatbread' },
  { unicode: '🥚', short_name: 'egg', title: 'Egg' },
  { unicode: '🍳', short_name: 'fried_egg', title: 'Cooking' },
  { unicode: '🥘', short_name: 'shallow_pan_of_food', title: 'Shallow Pan of Food' },
  { unicode: '🍲', short_name: 'stew', title: 'Pot of Food' },
  { unicode: '🥣', short_name: 'bowl_with_spoon', title: 'Bowl with Spoon' },
  { unicode: '🥗', short_name: 'green_salad', title: 'Green Salad' },
  { unicode: '🍿', short_name: 'popcorn', title: 'Popcorn' },
  { unicode: '🍱', short_name: 'bento', title: 'Bento Box' },
  { unicode: '🍘', short_name: 'rice_cracker', title: 'Rice Cracker' },
  { unicode: '🍙', short_name: 'rice_ball', title: 'Rice Ball' },
  { unicode: '🍚', short_name: 'rice', title: 'Cooked Rice' },
  { unicode: '🍛', short_name: 'curry', title: 'Curry Rice' },
  { unicode: '🍜', short_name: 'ramen', title: 'Steaming Bowl' },
  { unicode: '🍝', short_name: 'spaghetti', title: 'Spaghetti' },
  { unicode: '🍠', short_name: 'sweet_potato', title: 'Roasted Sweet Potato' },
  { unicode: '🍢', short_name: 'oden', title: 'Oden' },
  { unicode: '🍣', short_name: 'sushi', title: 'Sushi' },
  { unicode: '🍤', short_name: 'fried_shrimp', title: 'Fried Shrimp' },
  { unicode: '🍥', short_name: 'fish_cake', title: 'Fish Cake with Swirl' },
  { unicode: '🥮', short_name: 'moon_cake', title: 'Moon Cake' },
  { unicode: '🍡', short_name: 'dango', title: 'Dango' },
  { unicode: '🥟', short_name: 'dumpling', title: 'Dumpling' },
  { unicode: '🥠', short_name: 'fortune_cookie', title: 'Fortune Cookie' },
  { unicode: '🥡', short_name: 'takeout_box', title: 'Takeout Box' },
  { unicode: '🍦', short_name: 'icecream', title: 'Soft Ice Cream' },
  { unicode: '🍧', short_name: 'shaved_ice', title: 'Shaved Ice' },
  { unicode: '🍨', short_name: 'ice_cream', title: 'Ice Cream' },
  { unicode: '🍩', short_name: 'doughnut', title: 'Doughnut' },
  { unicode: '🍪', short_name: 'cookie', title: 'Cookie' },
  { unicode: '🎂', short_name: 'birthday', title: 'Birthday Cake' },
  { unicode: '🍰', short_name: 'cake', title: 'Shortcake' },
  { unicode: '🧁', short_name: 'cupcake', title: 'Cupcake' },
  { unicode: '🥧', short_name: 'pie', title: 'Pie' },
  { unicode: '🍫', short_name: 'chocolate_bar', title: 'Chocolate Bar' },
  { unicode: '🍬', short_name: 'candy', title: 'Candy' },
  { unicode: '🍭', short_name: 'lollipop', title: 'Lollipop' },
  { unicode: '🍮', short_name: 'custard', title: 'Custard' },
  { unicode: '🍯', short_name: 'honey_pot', title: 'Honey Pot' },
  { unicode: '🍼', short_name: 'baby_bottle', title: 'Baby Bottle' },
  { unicode: '🥛', short_name: 'glass_of_milk', title: 'Glass of Milk' },
  { unicode: '☕', short_name: 'coffee', title: 'Hot Beverage' },
  { unicode: '🍵', short_name: 'tea', title: 'Teacup Without Handle' },
  { unicode: '🍶', short_name: 'sake', title: 'Sake Bottle and Cup' },
  { unicode: '🍾', short_name: 'champagne', title: 'Bottle with Popping Cork' },
  { unicode: '🍷', short_name: 'wine_glass', title: 'Wine Glass' },
  { unicode: '🍸', short_name: 'cocktail', title: 'Cocktail Glass' },
  { unicode: '🍹', short_name: 'tropical_drink', title: 'Tropical Drink' },
  { unicode: '🍺', short_name: 'beer', title: 'Beer Mug' },
  { unicode: '🍻', short_name: 'beers', title: 'Clinking Beer Mugs' },
  { unicode: '🥂', short_name: 'clinking_glasses', title: 'Clinking Glasses' },
  { unicode: '🥃', short_name: 'tumbler_glass', title: 'Tumbler Glass' },
  { unicode: '🥤', short_name: 'cup_with_straw', title: 'Cup with Straw' },
  { unicode: '🥢', short_name: 'chopsticks', title: 'Chopsticks' },
  { unicode: '🍽️', short_name: 'plate_with_cutlery', title: 'Fork and Knife with Plate' },
  { unicode: '🍴', short_name: 'fork_and_knife', title: 'Fork and Knife' },
  { unicode: '🥄', short_name: 'spoon', title: 'Spoon' },
];

// Celebration category emojis
const CELEBRATION_CATEGORY: Emoji[] = [
  { unicode: '🎉', short_name: 'tada', title: 'Party Popper' },
  { unicode: '🎊', short_name: 'confetti_ball', title: 'Confetti Ball' },
  { unicode: '🎈', short_name: 'balloon', title: 'Balloon' },
  { unicode: '🎁', short_name: 'gift', title: 'Wrapped Gift' },
  { unicode: '🎀', short_name: 'ribbon', title: 'Ribbon' },
  { unicode: '🎂', short_name: 'birthday', title: 'Birthday Cake' },
  { unicode: '🎃', short_name: 'jack_o_lantern', title: 'Jack-O-Lantern' },
  { unicode: '🎄', short_name: 'christmas_tree', title: 'Christmas Tree' },
  { unicode: '🎅', short_name: 'santa', title: 'Santa Claus' },
  { unicode: '🤶', short_name: 'mrs_claus', title: 'Mrs. Claus' },
  { unicode: '🧑‍🎄', short_name: 'mx_claus', title: 'Mx Claus' },
  { unicode: '🦌', short_name: 'deer', title: 'Deer' },
  { unicode: '☃️', short_name: 'snowman_with_snow', title: 'Snowman' },
  { unicode: '⛄', short_name: 'snowman', title: 'Snowman Without Snow' },
  { unicode: '🎆', short_name: 'fireworks', title: 'Fireworks' },
  { unicode: '🎇', short_name: 'sparkler', title: 'Sparkler' },
  { unicode: '✨', short_name: 'sparkles', title: 'Sparkles' },
  { unicode: '🎗️', short_name: 'reminder_ribbon', title: 'Reminder Ribbon' },
  { unicode: '🎟️', short_name: 'tickets', title: 'Admission Tickets' },
  { unicode: '🎫', short_name: 'ticket', title: 'Ticket' },
  { unicode: '🎖️', short_name: 'medal_military', title: 'Military Medal' },
  { unicode: '🏆', short_name: 'trophy', title: 'Trophy' },
  { unicode: '🏅', short_name: 'medal_sports', title: 'Sports Medal' },
  { unicode: '🥇', short_name: '1st_place_medal', title: '1st Place Medal' },
  { unicode: '🥈', short_name: '2nd_place_medal', title: '2nd Place Medal' },
  { unicode: '🥉', short_name: '3rd_place_medal', title: '3rd Place Medal' },
  { unicode: '⚽', short_name: 'soccer', title: 'Soccer Ball' },
  { unicode: '⚾', short_name: 'baseball', title: 'Baseball' },
  { unicode: '🏀', short_name: 'basketball', title: 'Basketball' },
  { unicode: '🏐', short_name: 'volleyball', title: 'Volleyball' },
  { unicode: '🏈', short_name: 'football', title: 'American Football' },
  { unicode: '🏉', short_name: 'rugby_football', title: 'Rugby Football' },
  { unicode: '🎾', short_name: 'tennis', title: 'Tennis' },
  { unicode: '🎱', short_name: '8ball', title: 'Pool 8 Ball' },
  { unicode: '🎯', short_name: 'dart', title: 'Direct Hit' },
  { unicode: '🎳', short_name: 'bowling', title: 'Bowling' },
  { unicode: '🎮', short_name: 'video_game', title: 'Video Game' },
  { unicode: '🎰', short_name: 'slot_machine', title: 'Slot Machine' },
  { unicode: '🎲', short_name: 'game_die', title: 'Game Die' },
  { unicode: '🧩', short_name: 'jigsaw', title: 'Puzzle Piece' },
  { unicode: '🎴', short_name: 'flower_playing_cards', title: 'Flower Playing Cards' },
  { unicode: '🃏', short_name: 'black_joker', title: 'Joker' },
  { unicode: '🀄', short_name: 'mahjong', title: 'Mahjong Red Dragon' },
  { unicode: '🎭', short_name: 'performing_arts', title: 'Performing Arts' },
  { unicode: '🎨', short_name: 'art', title: 'Artist Palette' },
  { unicode: '🎪', short_name: 'circus_tent', title: 'Circus Tent' },
  { unicode: '🎬', short_name: 'movie_camera', title: 'Movie Camera' },
  { unicode: '🎤', short_name: 'microphone', title: 'Microphone' },
  { unicode: '🎧', short_name: 'headphones', title: 'Headphone' },
  { unicode: '🎼', short_name: 'musical_score', title: 'Musical Score' },
  { unicode: '🎵', short_name: 'musical_note', title: 'Musical Note' },
  { unicode: '🎶', short_name: 'notes', title: 'Musical Notes' },
  { unicode: '🎙️', short_name: 'studio_microphone', title: 'Studio Microphone' },
  { unicode: '🎚️', short_name: 'level_slider', title: 'Level Slider' },
  { unicode: '🎛️', short_name: 'control_knobs', title: 'Control Knobs' },
  { unicode: '🎹', short_name: 'musical_keyboard', title: 'Musical Keyboard' },
  { unicode: '🥁', short_name: 'drum', title: 'Drum' },
  { unicode: '🎷', short_name: 'saxophone', title: 'Saxophone' },
  { unicode: '🎺', short_name: 'trumpet', title: 'Trumpet' },
  { unicode: '🎸', short_name: 'guitar', title: 'Guitar' },
  { unicode: '🎻', short_name: 'violin', title: 'Violin' },
  { unicode: '🎲', short_name: 'game_die', title: 'Game Die' },
];

// Activity category emojis
const ACTIVITY_CATEGORY: Emoji[] = [
  { unicode: '⚽', short_name: 'soccer', title: 'Soccer Ball' },
  { unicode: '⚾', short_name: 'baseball', title: 'Baseball' },
  { unicode: '🏀', short_name: 'basketball', title: 'Basketball' },
  { unicode: '🏐', short_name: 'volleyball', title: 'Volleyball' },
  { unicode: '🏈', short_name: 'football', title: 'American Football' },
  { unicode: '🏉', short_name: 'rugby_football', title: 'Rugby Football' },
  { unicode: '🎾', short_name: 'tennis', title: 'Tennis' },
  { unicode: '🎱', short_name: '8ball', title: 'Pool 8 Ball' },
  { unicode: '🎯', short_name: 'dart', title: 'Direct Hit' },
  { unicode: '🎳', short_name: 'bowling', title: 'Bowling' },
  { unicode: '🏓', short_name: 'ping_pong', title: 'Ping Pong' },
  { unicode: '🏸', short_name: 'badminton', title: 'Badminton' },
  { unicode: '🥊', short_name: 'boxing_glove', title: 'Boxing Glove' },
  { unicode: '🥋', short_name: 'martial_arts_uniform', title: 'Martial Arts Uniform' },
  { unicode: '🥅', short_name: 'goal_net', title: 'Goal Net' },
  { unicode: '⛳', short_name: 'golf', title: 'Flag in Hole' },
  { unicode: '⛸️', short_name: 'ice_skate', title: 'Ice Skate' },
  { unicode: '🎣', short_name: 'fishing_pole_and_fish', title: 'Fishing Pole' },
  { unicode: '🎽', short_name: 'running_shirt_with_sash', title: 'Running Shirt with Sash' },
  { unicode: '🎿', short_name: 'ski', title: 'Skis' },
  { unicode: '🛷', short_name: 'sled', title: 'Sled' },
  { unicode: '🥌', short_name: 'curling_stone', title: 'Curling Stone' },
  { unicode: '🎯', short_name: 'dart', title: 'Direct Hit' },
  { unicode: '🎮', short_name: 'video_game', title: 'Video Game' },
  { unicode: '🎰', short_name: 'slot_machine', title: 'Slot Machine' },
  { unicode: '🎲', short_name: 'game_die', title: 'Game Die' },
  { unicode: '🧩', short_name: 'jigsaw', title: 'Puzzle Piece' },
  { unicode: '🎴', short_name: 'flower_playing_cards', title: 'Flower Playing Cards' },
  { unicode: '🃏', short_name: 'black_joker', title: 'Joker' },
  { unicode: '🀄', short_name: 'mahjong', title: 'Mahjong Red Dragon' },
  { unicode: '🎭', short_name: 'performing_arts', title: 'Performing Arts' },
  { unicode: '🎨', short_name: 'art', title: 'Artist Palette' },
  { unicode: '🎪', short_name: 'circus_tent', title: 'Circus Tent' },
  { unicode: '🎬', short_name: 'movie_camera', title: 'Movie Camera' },
  { unicode: '🎤', short_name: 'microphone', title: 'Microphone' },
  { unicode: '🎧', short_name: 'headphones', title: 'Headphone' },
  { unicode: '🎼', short_name: 'musical_score', title: 'Musical Score' },
  { unicode: '🎵', short_name: 'musical_note', title: 'Musical Note' },
  { unicode: '🎶', short_name: 'notes', title: 'Musical Notes' },
  { unicode: '🎙️', short_name: 'studio_microphone', title: 'Studio Microphone' },
  { unicode: '🎚️', short_name: 'level_slider', title: 'Level Slider' },
  { unicode: '🎛️', short_name: 'control_knobs', title: 'Control Knobs' },
  { unicode: '🎹', short_name: 'musical_keyboard', title: 'Musical Keyboard' },
  { unicode: '🥁', short_name: 'drum', title: 'Drum' },
  { unicode: '🎷', short_name: 'saxophone', title: 'Saxophone' },
  { unicode: '🎺', short_name: 'trumpet', title: 'Trumpet' },
  { unicode: '🎸', short_name: 'guitar', title: 'Guitar' },
  { unicode: '🎻', short_name: 'violin', title: 'Violin' },
];

// Places category emojis
const PLACES_CATEGORY: Emoji[] = [
  { unicode: '🏠', short_name: 'house', title: 'House' },
  { unicode: '🏡', short_name: 'house_with_garden', title: 'House with Garden' },
  { unicode: '🏢', short_name: 'office', title: 'Office Building' },
  { unicode: '🏣', short_name: 'post_office', title: 'Japanese Post Office' },
  { unicode: '🏤', short_name: 'european_post_office', title: 'Post Office' },
  { unicode: '🏥', short_name: 'hospital', title: 'Hospital' },
  { unicode: '🏦', short_name: 'bank', title: 'Bank' },
  { unicode: '🏨', short_name: 'hotel', title: 'Hotel' },
  { unicode: '🏩', short_name: 'love_hotel', title: 'Love Hotel' },
  { unicode: '🏪', short_name: 'convenience_store', title: 'Convenience Store' },
  { unicode: '🏫', short_name: 'school', title: 'School' },
  { unicode: '🏬', short_name: 'department_store', title: 'Department Store' },
  { unicode: '🏭', short_name: 'factory', title: 'Factory' },
  { unicode: '🏯', short_name: 'japanese_castle', title: 'Japanese Castle' },
  { unicode: '🏰', short_name: 'european_castle', title: 'Castle' },
  { unicode: '💒', short_name: 'wedding', title: 'Wedding' },
  { unicode: '🗼', short_name: 'tokyo_tower', title: 'Tokyo Tower' },
  { unicode: '🗽', short_name: 'statue_of_liberty', title: 'Statue of Liberty' },
  { unicode: '⛪', short_name: 'church', title: 'Church' },
  { unicode: '🕌', short_name: 'mosque', title: 'Mosque' },
  { unicode: '🛕', short_name: 'hindu_temple', title: 'Hindu Temple' },
  { unicode: '🕍', short_name: 'synagogue', title: 'Synagogue' },
  { unicode: '⛩️', short_name: 'shinto_shrine', title: 'Shinto Shrine' },
  { unicode: '🕋', short_name: 'kaaba', title: 'Kaaba' },
  { unicode: '⛲', short_name: 'fountain', title: 'Fountain' },
  { unicode: '⛺', short_name: 'tent', title: 'Tent' },
  { unicode: '🌁', short_name: 'foggy', title: 'Foggy' },
  { unicode: '🌃', short_name: 'night_with_stars', title: 'Night with Stars' },
  { unicode: '🏙️', short_name: 'cityscape', title: 'Cityscape' },
  { unicode: '🌄', short_name: 'sunrise_over_mountains', title: 'Sunrise Over Mountains' },
  { unicode: '🌅', short_name: 'sunrise', title: 'Sunrise' },
  { unicode: '🌆', short_name: 'city_sunset', title: 'Cityscape at Dusk' },
  { unicode: '🌇', short_name: 'city_sunrise', title: 'Sunset' },
  { unicode: '🌉', short_name: 'bridge_at_night', title: 'Bridge at Night' },
  { unicode: '♨️', short_name: 'hotsprings', title: 'Hot Springs' },
  { unicode: '🎠', short_name: 'carousel_horse', title: 'Carousel Horse' },
  { unicode: '🎡', short_name: 'ferris_wheel', title: 'Ferris Wheel' },
  { unicode: '🎢', short_name: 'roller_coaster', title: 'Roller Coaster' },
  { unicode: '💈', short_name: 'barber', title: 'Barber Pole' },
  { unicode: '🎪', short_name: 'circus_tent', title: 'Circus Tent' },
  { unicode: '🚂', short_name: 'steam_locomotive', title: 'Locomotive' },
  { unicode: '🚃', short_name: 'railway_car', title: 'Railway Car' },
  { unicode: '🚄', short_name: 'bullettrain_side', title: 'High-Speed Train' },
  { unicode: '🚅', short_name: 'bullettrain_front', title: 'Bullet Train' },
  { unicode: '🚆', short_name: 'train2', title: 'Train' },
  { unicode: '🚇', short_name: 'metro', title: 'Metro' },
  { unicode: '🚈', short_name: 'light_rail', title: 'Light Rail' },
  { unicode: '🚉', short_name: 'station', title: 'Station' },
  { unicode: '🚊', short_name: 'tram', title: 'Tram' },
  { unicode: '🚝', short_name: 'monorail', title: 'Monorail' },
  { unicode: '🚞', short_name: 'mountain_railway', title: 'Mountain Railway' },
  { unicode: '🚋', short_name: 'train', title: 'Tram Car' },
  { unicode: '🚌', short_name: 'bus', title: 'Bus' },
  { unicode: '🚍', short_name: 'oncoming_bus', title: 'Oncoming Bus' },
  { unicode: '🚎', short_name: 'trolleybus', title: 'Trolleybus' },
  { unicode: '🚐', short_name: 'minibus', title: 'Minibus' },
  { unicode: '🚑', short_name: 'ambulance', title: 'Ambulance' },
  { unicode: '🚒', short_name: 'fire_engine', title: 'Fire Engine' },
  { unicode: '🚓', short_name: 'police_car', title: 'Police Car' },
  { unicode: '🚔', short_name: 'oncoming_police_car', title: 'Oncoming Police Car' },
  { unicode: '🚕', short_name: 'taxi', title: 'Taxi' },
  { unicode: '🚖', short_name: 'oncoming_taxi', title: 'Oncoming Taxi' },
  { unicode: '🚗', short_name: 'car', title: 'Automobile' },
  { unicode: '🚘', short_name: 'oncoming_automobile', title: 'Oncoming Automobile' },
  { unicode: '🚙', short_name: 'blue_car', title: 'Sport Utility Vehicle' },
  { unicode: '🚚', short_name: 'truck', title: 'Delivery Truck' },
  { unicode: '🚛', short_name: 'articulated_lorry', title: 'Articulated Lorry' },
  { unicode: '🚜', short_name: 'tractor', title: 'Tractor' },
  { unicode: '🏎️', short_name: 'racing_car', title: 'Racing Car' },
  { unicode: '🏍️', short_name: 'motorcycle', title: 'Motorcycle' },
  { unicode: '🛵', short_name: 'motor_scooter', title: 'Motor Scooter' },
  { unicode: '🦽', short_name: 'manual_wheelchair', title: 'Manual Wheelchair' },
  { unicode: '🦼', short_name: 'motorized_wheelchair', title: 'Motorized Wheelchair' },
  { unicode: '🛴', short_name: 'kick_scooter', title: 'Kick Scooter' },
  { unicode: '🚲', short_name: 'bike', title: 'Bicycle' },
  { unicode: '🛴', short_name: 'kick_scooter', title: 'Kick Scooter' },
  { unicode: '🛹', short_name: 'skateboard', title: 'Skateboard' },
  { unicode: '🛼', short_name: 'roller_skate', title: 'Roller Skate' },
  { unicode: '🚁', short_name: 'helicopter', title: 'Helicopter' },
  { unicode: '🚟', short_name: 'suspension_railway', title: 'Suspension Railway' },
  { unicode: '🚠', short_name: 'mountain_cableway', title: 'Mountain Cableway' },
  { unicode: '🚡', short_name: 'aerial_tramway', title: 'Aerial Tramway' },
  { unicode: '✈️', short_name: 'airplane', title: 'Airplane' },
  { unicode: '🛩️', short_name: 'small_airplane', title: 'Small Airplane' },
  { unicode: '🛫', short_name: 'flight_departure', title: 'Airplane Departure' },
  { unicode: '🛬', short_name: 'flight_arrival', title: 'Airplane Arrival' },
  { unicode: '🪂', short_name: 'parachute', title: 'Parachute' },
  { unicode: '💺', short_name: 'seat', title: 'Seat' },
  { unicode: '🚀', short_name: 'rocket', title: 'Rocket' },
  { unicode: '🛸', short_name: 'flying_saucer', title: 'Flying Saucer' },
  { unicode: '🚤', short_name: 'speedboat', title: 'Speedboat' },
  { unicode: '⛵', short_name: 'sailboat', title: 'Sailboat' },
  { unicode: '🛥️', short_name: 'motor_boat', title: 'Motor Boat' },
  { unicode: '🛳️', short_name: 'cruise_ship', title: 'Passenger Ship' },
  { unicode: '⛴️', short_name: 'ferry', title: 'Ferry' },
  { unicode: '🚢', short_name: 'ship', title: 'Ship' },
  { unicode: '⚓', short_name: 'anchor', title: 'Anchor' },
  { unicode: '⛽', short_name: 'fuelpump', title: 'Fuel Pump' },
  { unicode: '🚧', short_name: 'construction', title: 'Construction Sign' },
  { unicode: '🚦', short_name: 'traffic_light', title: 'Vertical Traffic Light' },
  { unicode: '🚥', short_name: 'traffic_light', title: 'Horizontal Traffic Light' },
  { unicode: '🗺️', short_name: 'world_map', title: 'World Map' },
  { unicode: '🗿', short_name: 'moyai', title: 'Moai' },
  { unicode: '🗽', short_name: 'statue_of_liberty', title: 'Statue of Liberty' },
  { unicode: '🗼', short_name: 'tokyo_tower', title: 'Tokyo Tower' },
  { unicode: '🏰', short_name: 'european_castle', title: 'Castle' },
  { unicode: '🏯', short_name: 'japanese_castle', title: 'Japanese Castle' },
  { unicode: '🏟️', short_name: 'stadium', title: 'Stadium' },
  { unicode: '🎡', short_name: 'ferris_wheel', title: 'Ferris Wheel' },
  { unicode: '🎢', short_name: 'roller_coaster', title: 'Roller Coaster' },
  { unicode: '🎠', short_name: 'carousel_horse', title: 'Carousel Horse' },
  { unicode: '⛲', short_name: 'fountain', title: 'Fountain' },
  { unicode: '⛱️', short_name: 'parasol_on_ground', title: 'Umbrella on Ground' },
  { unicode: '🏖️', short_name: 'beach_umbrella', title: 'Beach with Umbrella' },
  { unicode: '🏝️', short_name: 'desert_island', title: 'Desert Island' },
  { unicode: '🏜️', short_name: 'desert', title: 'Desert' },
  { unicode: '🌋', short_name: 'volcano', title: 'Volcano' },
  { unicode: '⛰️', short_name: 'mountain', title: 'Mountain' },
  { unicode: '🏔️', short_name: 'mountain_snow', title: 'Snow-Capped Mountain' },
  { unicode: '🗻', short_name: 'mount_fuji', title: 'Mount Fuji' },
  { unicode: '🏕️', short_name: 'camping', title: 'Camping' },
  { unicode: '⛺', short_name: 'tent', title: 'Tent' },
  { unicode: '🏗️', short_name: 'building_construction', title: 'Building Construction' },
  { unicode: '🏘️', short_name: 'houses', title: 'Houses' },
  { unicode: '🏚️', short_name: 'derelict_house', title: 'Derelict House' },
  { unicode: '🏠', short_name: 'house', title: 'House' },
  { unicode: '🏡', short_name: 'house_with_garden', title: 'House with Garden' },
  { unicode: '🏢', short_name: 'office', title: 'Office Building' },
  { unicode: '🏣', short_name: 'post_office', title: 'Japanese Post Office' },
  { unicode: '🏤', short_name: 'european_post_office', title: 'Post Office' },
  { unicode: '🏥', short_name: 'hospital', title: 'Hospital' },
  { unicode: '🏦', short_name: 'bank', title: 'Bank' },
  { unicode: '🏨', short_name: 'hotel', title: 'Hotel' },
  { unicode: '🏩', short_name: 'love_hotel', title: 'Love Hotel' },
  { unicode: '🏪', short_name: 'convenience_store', title: 'Convenience Store' },
  { unicode: '🏫', short_name: 'school', title: 'School' },
  { unicode: '🏬', short_name: 'department_store', title: 'Department Store' },
  { unicode: '🏭', short_name: 'factory', title: 'Factory' },
  { unicode: '🏯', short_name: 'japanese_castle', title: 'Japanese Castle' },
  { unicode: '🏰', short_name: 'european_castle', title: 'Castle' },
  { unicode: '💒', short_name: 'wedding', title: 'Wedding' },
  { unicode: '🗼', short_name: 'tokyo_tower', title: 'Tokyo Tower' },
  { unicode: '🗽', short_name: 'statue_of_liberty', title: 'Statue of Liberty' },
  { unicode: '⛪', short_name: 'church', title: 'Church' },
  { unicode: '🕌', short_name: 'mosque', title: 'Mosque' },
  { unicode: '🛕', short_name: 'hindu_temple', title: 'Hindu Temple' },
  { unicode: '🕍', short_name: 'synagogue', title: 'Synagogue' },
  { unicode: '⛩️', short_name: 'shinto_shrine', title: 'Shinto Shrine' },
  { unicode: '🕋', short_name: 'kaaba', title: 'Kaaba' },
];

// Symbols category emojis
const SYMBOLS_CATEGORY: Emoji[] = [
  { unicode: '❤️', short_name: 'heart', title: 'Red Heart' },
  { unicode: '🧡', short_name: 'orange_heart', title: 'Orange Heart' },
  { unicode: '💛', short_name: 'yellow_heart', title: 'Yellow Heart' },
  { unicode: '💚', short_name: 'green_heart', title: 'Green Heart' },
  { unicode: '💙', short_name: 'blue_heart', title: 'Blue Heart' },
  { unicode: '💜', short_name: 'purple_heart', title: 'Purple Heart' },
  { unicode: '🖤', short_name: 'black_heart', title: 'Black Heart' },
  { unicode: '🤍', short_name: 'white_heart', title: 'White Heart' },
  { unicode: '🤎', short_name: 'brown_heart', title: 'Brown Heart' },
  { unicode: '💔', short_name: 'broken_heart', title: 'Broken Heart' },
  { unicode: '❣️', short_name: 'heart_exclamation', title: 'Heart Exclamation' },
  { unicode: '💕', short_name: 'two_hearts', title: 'Two Hearts' },
  { unicode: '💞', short_name: 'revolving_hearts', title: 'Revolving Hearts' },
  { unicode: '💓', short_name: 'heartbeat', title: 'Beating Heart' },
  { unicode: '💗', short_name: 'heartpulse', title: 'Growing Heart' },
  { unicode: '💖', short_name: 'sparkling_heart', title: 'Sparkling Heart' },
  { unicode: '💘', short_name: 'cupid', title: 'Heart with Arrow' },
  { unicode: '💝', short_name: 'gift_heart', title: 'Heart with Ribbon' },
  { unicode: '💟', short_name: 'heart_decoration', title: 'Heart Decoration' },
  { unicode: '☮️', short_name: 'peace_symbol', title: 'Peace Symbol' },
  { unicode: '✝️', short_name: 'cross', title: 'Latin Cross' },
  { unicode: '☪️', short_name: 'star_and_crescent', title: 'Star and Crescent' },
  { unicode: '🕉️', short_name: 'om', title: 'Om' },
  { unicode: '☸️', short_name: 'wheel_of_dharma', title: 'Wheel of Dharma' },
  { unicode: '✡️', short_name: 'star_of_david', title: 'Star of David' },
  { unicode: '🔯', short_name: 'six_pointed_star', title: 'Six-Pointed Star' },
  { unicode: '🕎', short_name: 'menorah', title: 'Menorah' },
  { unicode: '☯️', short_name: 'yin_yang', title: 'Yin Yang' },
  { unicode: '☦️', short_name: 'orthodox_cross', title: 'Orthodox Cross' },
  { unicode: '🛐', short_name: 'place_of_worship', title: 'Place of Worship' },
  { unicode: '⛎', short_name: 'ophiuchus', title: 'Ophiuchus' },
  { unicode: '♈', short_name: 'aries', title: 'Aries' },
  { unicode: '♉', short_name: 'taurus', title: 'Taurus' },
  { unicode: '♊', short_name: 'gemini', title: 'Gemini' },
  { unicode: '♋', short_name: 'cancer', title: 'Cancer' },
  { unicode: '♌', short_name: 'leo', title: 'Leo' },
  { unicode: '♍', short_name: 'virgo', title: 'Virgo' },
  { unicode: '♎', short_name: 'libra', title: 'Libra' },
  { unicode: '♏', short_name: 'scorpius', title: 'Scorpius' },
  { unicode: '♐', short_name: 'sagittarius', title: 'Sagittarius' },
  { unicode: '♑', short_name: 'capricorn', title: 'Capricorn' },
  { unicode: '♒', short_name: 'aquarius', title: 'Aquarius' },
  { unicode: '♓', short_name: 'pisces', title: 'Pisces' },
  { unicode: '🆔', short_name: 'id', title: 'ID Button' },
  { unicode: '⚛️', short_name: 'atom_symbol', title: 'Atom Symbol' },
  { unicode: '🉑', short_name: 'accept', title: 'Circled Ideograph Accept' },
  { unicode: '☢️', short_name: 'radioactive', title: 'Radioactive' },
  { unicode: '☣️', short_name: 'biohazard', title: 'Biohazard' },
  { unicode: '📴', short_name: 'mobile_phone_off', title: 'Mobile Phone Off' },
  { unicode: '📳', short_name: 'vibration_mode', title: 'Vibration Mode' },
  { unicode: '🈶', short_name: 'u6709', title: 'Circled Ideograph Have' },
  { unicode: '🈚', short_name: 'u7121', title: 'Circled Ideograph Not' },
  { unicode: '🈸', short_name: 'u7533', title: 'Circled Ideograph Apply' },
  { unicode: '🈺', short_name: 'u55b6', title: 'Circled Ideograph Operate' },
  { unicode: '🈷️', short_name: 'u6708', title: 'Circled Ideograph Moon' },
  { unicode: '✴️', short_name: 'eight_pointed_black_star', title: 'Eight-Pointed Star' },
  { unicode: '🆚', short_name: 'vs', title: 'VS Button' },
  { unicode: '💮', short_name: 'white_flower', title: 'White Flower' },
  { unicode: '🉐', short_name: 'ideograph_advantage', title: 'Circled Ideograph Advantage' },
  { unicode: '㊙️', short_name: 'secret', title: 'Circled Ideograph Secret' },
  { unicode: '㊗️', short_name: 'congratulations', title: 'Circled Ideograph Congratulation' },
  { unicode: '🈴', short_name: 'u5408', title: 'Circled Ideograph Together' },
  { unicode: '🈵', short_name: 'u6e80', title: 'Circled Ideograph Full' },
  { unicode: '🈹', short_name: 'u5272', title: 'Circled Ideograph Discount' },
  { unicode: '🈲', short_name: 'u7981', title: 'Circled Ideograph Prohibit' },
  { unicode: '🅰️', short_name: 'a', title: 'A Button (Blood Type)' },
  { unicode: '🅱️', short_name: 'b', title: 'B Button (Blood Type)' },
  { unicode: '🆎', short_name: 'ab', title: 'AB Button (Blood Type)' },
  { unicode: '🆑', short_name: 'cl', title: 'CL Button' },
  { unicode: '🅾️', short_name: 'o2', title: 'O Button (Blood Type)' },
  { unicode: '🆘', short_name: 'sos', title: 'SOS Button' },
  { unicode: '❌', short_name: 'x', title: 'Cross Mark' },
  { unicode: '⭕', short_name: 'o', title: 'Heavy Large Circle' },
  { unicode: '🛑', short_name: 'stop_sign', title: 'Stop Sign' },
  { unicode: '⛔', short_name: 'no_entry', title: 'No Entry' },
  { unicode: '📛', short_name: 'name_badge', title: 'Name Badge' },
  { unicode: '🚫', short_name: 'no_entry_sign', title: 'Prohibited' },
  { unicode: '💯', short_name: '100', title: 'Hundred Points' },
  { unicode: '💢', short_name: 'anger', title: 'Anger Symbol' },
  { unicode: '♨️', short_name: 'hotsprings', title: 'Hot Springs' },
  { unicode: '🚷', short_name: 'no_pedestrians', title: 'No Pedestrians' },
  { unicode: '🚯', short_name: 'do_not_litter', title: 'No Littering' },
  { unicode: '🚳', short_name: 'no_bicycles', title: 'No Bicycles' },
  { unicode: '🚱', short_name: 'non-potable_water', title: 'Non-Potable Water' },
  { unicode: '🔞', short_name: 'underage', title: 'No One Under Eighteen' },
  { unicode: '📵', short_name: 'no_mobile_phones', title: 'No Mobile Phones' },
  { unicode: '🚭', short_name: 'no_smoking', title: 'No Smoking' },
  { unicode: '❗', short_name: 'exclamation', title: 'Exclamation Mark' },
  { unicode: '❓', short_name: 'question', title: 'Question Mark' },
  { unicode: '❕', short_name: 'grey_exclamation', title: 'White Exclamation Mark' },
  { unicode: '❔', short_name: 'grey_question', title: 'White Question Mark' },
  { unicode: '‼️', short_name: 'bangbang', title: 'Double Exclamation Mark' },
  { unicode: '⁉️', short_name: 'interrobang', title: 'Exclamation Question Mark' },
  { unicode: '🔅', short_name: 'low_brightness', title: 'Dim Button' },
  { unicode: '🔆', short_name: 'high_brightness', title: 'Bright Button' },
  { unicode: '〽️', short_name: 'part_alternation_mark', title: 'Part Alternation Mark' },
  { unicode: '⚠️', short_name: 'warning', title: 'Warning' },
  { unicode: '🚸', short_name: 'children_crossing', title: 'Children Crossing' },
  { unicode: '🔱', short_name: 'trident', title: 'Trident Emblem' },
  { unicode: '⚜️', short_name: 'fleur_de_lis', title: 'Fleur-de-lis' },
  { unicode: '🔰', short_name: 'beginner', title: 'Japanese Symbol for Beginner' },
  { unicode: '♻️', short_name: 'recycle', title: 'Recycling Symbol' },
  { unicode: '✅', short_name: 'white_check_mark', title: 'Check Mark Button' },
  { unicode: '🈯', short_name: 'u6307', title: 'Circled Ideograph Finger' },
  { unicode: '💹', short_name: 'chart', title: 'Chart Increasing with Yen' },
  { unicode: '❇️', short_name: 'sparkle', title: 'Sparkle' },
  { unicode: '✳️', short_name: 'eight_spoked_asterisk', title: 'Eight-Spoked Asterisk' },
  { unicode: '❎', short_name: 'negative_squared_cross_mark', title: 'Cross Mark Button' },
  { unicode: '🌐', short_name: 'globe_with_meridians', title: 'Globe with Meridians' },
  { unicode: '💠', short_name: 'diamond_shape_with_a_dot_inside', title: 'Diamond with a Dot' },
  { unicode: 'Ⓜ️', short_name: 'm', title: 'Circled M' },
  { unicode: '🌀', short_name: 'cyclone', title: 'Cyclone' },
  { unicode: '💤', short_name: 'zzz', title: 'ZZZ' },
  { unicode: '🏧', short_name: 'atm', title: 'ATM Sign' },
  { unicode: '🚾', short_name: 'wc', title: 'Water Closet' },
  { unicode: '♿', short_name: 'wheelchair', title: 'Wheelchair Symbol' },
  { unicode: '🅿️', short_name: 'parking', title: 'P Button' },
  { unicode: '🈳', short_name: 'u7a7a', title: 'Circled Ideograph Empty' },
  { unicode: '🈂️', short_name: 'sa', title: 'Service Charge' },
  { unicode: '🛂', short_name: 'passport_control', title: 'Passport Control' },
  { unicode: '🛃', short_name: 'customs', title: 'Customs' },
  { unicode: '🛄', short_name: 'baggage_claim', title: 'Baggage Claim' },
  { unicode: '🛅', short_name: 'left_luggage', title: 'Left Luggage' },
  { unicode: '🚹', short_name: 'mens', title: 'Men\'s Room' },
  { unicode: '🚺', short_name: 'womens', title: 'Women\'s Room' },
  { unicode: '🚼', short_name: 'baby_symbol', title: 'Baby Symbol' },
  { unicode: '🚻', short_name: 'restroom', title: 'Restroom' },
  { unicode: '🚮', short_name: 'put_litter_in_its_place', title: 'Litter in Bin Sign' },
  { unicode: '🎦', short_name: 'cinema', title: 'Cinema' },
  { unicode: '📶', short_name: 'signal_strength', title: 'Antenna Bars' },
  { unicode: '🈁', short_name: 'koko', title: 'Squared Katakana Koko' },
  { unicode: '🔣', short_name: 'symbols', title: 'Input Symbols' },
  { unicode: 'ℹ️', short_name: 'information_source', title: 'Information' },
  { unicode: '🔤', short_name: 'abc', title: 'Input Latin Letters' },
  { unicode: '🔡', short_name: 'abcd', title: 'Input Latin Lowercase' },
  { unicode: '🔠', short_name: 'capital_abcd', title: 'Input Latin Uppercase' },
  { unicode: '🔢', short_name: '1234', title: 'Input Numbers' },
  { unicode: '🔣', short_name: 'symbols', title: 'Input Symbols' },
  { unicode: '🔤', short_name: 'abc', title: 'Input Latin Letters' },
  { unicode: '🆖', short_name: 'ng', title: 'NG Button' },
  { unicode: '🆗', short_name: 'ok', title: 'OK Button' },
  { unicode: '🆙', short_name: 'up', title: 'UP! Button' },
  { unicode: '🆒', short_name: 'cool', title: 'COOL Button' },
  { unicode: '🆕', short_name: 'new', title: 'NEW Button' },
  { unicode: '🆓', short_name: 'free', title: 'FREE Button' },
  { unicode: '0️⃣', short_name: 'zero', title: 'Keycap: 0' },
  { unicode: '1️⃣', short_name: 'one', title: 'Keycap: 1' },
  { unicode: '2️⃣', short_name: 'two', title: 'Keycap: 2' },
  { unicode: '3️⃣', short_name: 'three', title: 'Keycap: 3' },
  { unicode: '4️⃣', short_name: 'four', title: 'Keycap: 4' },
  { unicode: '5️⃣', short_name: 'five', title: 'Keycap: 5' },
  { unicode: '6️⃣', short_name: 'six', title: 'Keycap: 6' },
  { unicode: '7️⃣', short_name: 'seven', title: 'Keycap: 7' },
  { unicode: '8️⃣', short_name: 'eight', title: 'Keycap: 8' },
  { unicode: '9️⃣', short_name: 'nine', title: 'Keycap: 9' },
  { unicode: '🔟', short_name: 'keycap_ten', title: 'Keycap: 10' },
  { unicode: '🔠', short_name: 'capital_abcd', title: 'Input Latin Uppercase' },
  { unicode: '🔡', short_name: 'abcd', title: 'Input Latin Lowercase' },
  { unicode: '🔢', short_name: '1234', title: 'Input Numbers' },
  { unicode: '🔣', short_name: 'symbols', title: 'Input Symbols' },
  { unicode: '🔤', short_name: 'abc', title: 'Input Latin Letters' },
  { unicode: '🅰️', short_name: 'a', title: 'A Button (Blood Type)' },
  { unicode: '🆎', short_name: 'ab', title: 'AB Button (Blood Type)' },
  { unicode: '🅱️', short_name: 'b', title: 'B Button (Blood Type)' },
  { unicode: '🆑', short_name: 'cl', title: 'CL Button' },
  { unicode: '🆒', short_name: 'cool', title: 'COOL Button' },
  { unicode: '🆓', short_name: 'free', title: 'FREE Button' },
  { unicode: 'ℹ️', short_name: 'information_source', title: 'Information' },
  { unicode: '🆔', short_name: 'id', title: 'ID Button' },
  { unicode: 'Ⓜ️', short_name: 'm', title: 'Circled M' },
  { unicode: '🆕', short_name: 'new', title: 'NEW Button' },
  { unicode: '🆖', short_name: 'ng', title: 'NG Button' },
  { unicode: '🆗', short_name: 'ok', title: 'OK Button' },
  { unicode: '🅾️', short_name: 'o2', title: 'O Button (Blood Type)' },
  { unicode: '🆘', short_name: 'sos', title: 'SOS Button' },
  { unicode: '🆙', short_name: 'up', title: 'UP! Button' },
  { unicode: '🆚', short_name: 'vs', title: 'VS Button' },
  { unicode: '🈁', short_name: 'koko', title: 'Squared Katakana Koko' },
  { unicode: '🈂️', short_name: 'sa', title: 'Service Charge' },
  { unicode: '🈷️', short_name: 'u6708', title: 'Circled Ideograph Moon' },
  { unicode: '🈶', short_name: 'u6709', title: 'Circled Ideograph Have' },
  { unicode: '🈯', short_name: 'u6307', title: 'Circled Ideograph Finger' },
  { unicode: '🉐', short_name: 'ideograph_advantage', title: 'Circled Ideograph Advantage' },
  { unicode: '🈹', short_name: 'u5272', title: 'Circled Ideograph Discount' },
  { unicode: '🈲', short_name: 'u7981', title: 'Circled Ideograph Prohibit' },
  { unicode: '🉑', short_name: 'accept', title: 'Circled Ideograph Accept' },
  { unicode: '🈸', short_name: 'u7533', title: 'Circled Ideograph Apply' },
  { unicode: '🈴', short_name: 'u5408', title: 'Circled Ideograph Together' },
  { unicode: '🈳', short_name: 'u7a7a', title: 'Circled Ideograph Empty' },
  { unicode: '㊗️', short_name: 'congratulations', title: 'Circled Ideograph Congratulation' },
  { unicode: '㊙️', short_name: 'secret', title: 'Circled Ideograph Secret' },
  { unicode: '🈺', short_name: 'u55b6', title: 'Circled Ideograph Operate' },
  { unicode: '🈵', short_name: 'u6e80', title: 'Circled Ideograph Full' },
];

const EMOJI_CATEGORIES: EmojiCategory[] = [
  { category: 'Frequently Used', emojisList: FREQUENTLY_USED },
  { category: 'People', emojisList: PEOPLE_CATEGORY },
  { category: 'Nature', emojisList: NATURE_CATEGORY },
  { category: 'Food', emojisList: FOOD_CATEGORY },
  { category: 'Celebration', emojisList: CELEBRATION_CATEGORY },
  { category: 'Activity', emojisList: ACTIVITY_CATEGORY },
  { category: 'Places', emojisList: PLACES_CATEGORY },
  { category: 'Symbols', emojisList: SYMBOLS_CATEGORY },
];

export default function EmojiPicker({ onEmojiSelect, disabled = false }: EmojiPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [randomEmojiIcon, setRandomEmojiIcon] = useState<string | null>(null);
  const [searchText, setSearchText] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(0);
  const popoverRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Handle hover - generate random emoji icon (matches AngularJS line 71-98)
  const handleMouseEnter = () => {
    if (disabled) return;
    
    // Generate a new random emoji on hover (matches AngularJS behavior)
    // Only generate if not already hovered (prevents double generation on hover)
    // Don't generate if picker is already open (keep the existing random emoji)
    if (!isHovered && !isOpen) {
      const random = Math.floor((Math.random() * 10) + 1);
      const randomString = random.toString().padStart(2, '0');
      setRandomEmojiIcon(randomString);
    }
    setIsHovered(true);
  };

  const handleMouseLeave = () => {
    if (disabled) return;
    
    // Only remove hover state if picker is not open (matches AngularJS behavior)
    // When picker is open (clicked), keep the hover emoji icon visible
    if (!isOpen) {
      setIsHovered(false);
      // Keep randomEmojiIcon until next hover or until picker closes
    }
  };

  // Close popover on outside click (matches AngularJS line 343-359)
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        popoverRef.current &&
        !popoverRef.current.contains(target) &&
        buttonRef.current &&
        !buttonRef.current.contains(target)
      ) {
        setIsOpen(false);
        setSearchText('');
        // Reset hover state and random emoji icon when closing (matches AngularJS)
        setIsHovered(false);
        setRandomEmojiIcon(null);
      }
    };

    window.addEventListener('mousedown', handleClickOutside, true);
    return () => {
      window.removeEventListener('mousedown', handleClickOutside, true);
    };
  }, [isOpen]);

  // Close on Escape key (matches AngularJS line 242-259)
  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
        setSearchText('');
        // Reset hover state and random emoji icon when closing (matches AngularJS)
        setIsHovered(false);
        setRandomEmojiIcon(null);
      }
    };

    window.addEventListener('keyup', handleEscape);
    return () => {
      window.removeEventListener('keyup', handleEscape);
    };
  }, [isOpen]);

  // Focus search input when popover opens
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 100);
    }
  }, [isOpen]);

  const handleEmojiClick = (unicode: string) => {
    onEmojiSelect(unicode);
    setIsOpen(false);
    setSearchText('');
    // Reset hover state and random emoji icon when closing (matches AngularJS)
    setIsHovered(false);
    setRandomEmojiIcon(null);
  };

  const handleButtonClick = () => {
    if (disabled) return;
    const newIsOpen = !isOpen;
    setIsOpen(newIsOpen);
    
    // When closing the picker, reset hover state and random emoji icon (matches AngularJS)
    if (!newIsOpen) {
      setIsHovered(false);
      setRandomEmojiIcon(null);
    }
    // When opening, if we have a random emoji icon from hover, keep it visible
    // (don't reset it - it will stay visible until picker closes)
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchText(e.target.value);
    if (e.target.value.trim()) {
      setSelectedCategory(-1);
    } else {
      setSelectedCategory(0);
    }
  };

  const handleClearSearch = () => {
    setSearchText('');
    setSelectedCategory(0);
    searchInputRef.current?.focus();
  };

  const handleCategorySelect = (index: number) => {
    setSelectedCategory(index);
    setSearchText('');
    // Scroll to category
    if (containerRef.current) {
      const categoryElements = containerRef.current.querySelectorAll('.emoji-category');
      if (categoryElements[index]) {
        categoryElements[index].scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  };

  // Filter emojis based on search
  const getFilteredEmojis = useCallback(() => {
    if (!searchText.trim()) {
      return EMOJI_CATEGORIES;
    }

    const searchLower = searchText.toLowerCase();
    const filtered: EmojiCategory[] = [];

    EMOJI_CATEGORIES.forEach(category => {
      const matchingEmojis = category.emojisList.filter(emoji =>
        emoji.short_name.toLowerCase().includes(searchLower) ||
        emoji.title?.toLowerCase().includes(searchLower) ||
        emoji.unicode.includes(searchText)
      );

      if (matchingEmojis.length > 0) {
        filtered.push({
          category: category.category,
          emojisList: matchingEmojis,
        });
      }
    });

    return filtered;
  }, [searchText]);

  const filteredCategories = getFilteredEmojis();

  // Calculate popover position (matches AngularJS getEmojiPopoverOnPosition line 116-238)
  const getPopoverPosition = () => {
    if (!buttonRef.current) return { top: 0, left: 0 };

    const rect = buttonRef.current.getBoundingClientRect();
    const popoverWidth = 352;
    const popoverHeight = 332;
    const windowHeight = window.innerHeight;
    const windowWidth = window.innerWidth;

    // Try above first (matches AngularJS elementAbove)
    if (rect.top - popoverHeight > 0) {
      return {
        top: rect.top - popoverHeight - 2,
        left: rect.left + rect.width / 2 - popoverWidth / 2,
        placement: 'top' as const,
      };
    }

    // Try below (matches AngularJS elementBelow)
    if (rect.bottom + popoverHeight < windowHeight) {
      return {
        top: rect.top + rect.height + 2,
        left: rect.left + rect.width / 2 - popoverWidth / 2,
        placement: 'bottom' as const,
      };
    }

    // Default to above with adjustment
    return {
      top: Math.max(0, rect.top - popoverHeight),
      left: Math.max(0, Math.min(rect.left + rect.width / 2 - popoverWidth / 2, windowWidth - popoverWidth)),
      placement: 'top' as const,
    };
  };

  const position = isOpen ? getPopoverPosition() : null;

  return (
    <>
      <div
        ref={buttonRef}
        className={`emoji-popup-btn ${isOpen ? 'clicked' : 'unselected'} ${randomEmojiIcon && (isHovered || isOpen) ? `emoji-hover-icon-thick-${randomEmojiIcon}` : ''}`}
        onClick={handleButtonClick}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        style={{
          cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.5 : undefined,
          width: '19px',
          height: '19px',
          display: 'inline-block',
          verticalAlign: 'middle',
          borderRadius: '100%',
          backgroundSize: '16px',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
          // Show random emoji icon when hovering OR when picker is open (matches AngularJS)
          // Hide default icon when random emoji icon is active
          backgroundImage: (randomEmojiIcon && (isHovered || isOpen)) ? undefined : 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'16\' height=\'16\' viewBox=\'0 0 24 24\' fill=\'%237b8386\'%3E%3Cpath d=\'M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm0 18c-4.418 0-8-3.582-8-8s3.582-8 8-8 8 3.582 8 8-3.582 8-8 8z\'/%3E%3Cpath d=\'M8 14s1.5 2 4 2 4-2 4-2\' stroke=\'%237b8386\' stroke-width=\'1.5\' fill=\'none\' stroke-linecap=\'round\'/%3E%3Ccircle cx=\'9\' cy=\'9\' r=\'1\' fill=\'%237b8386\'/%3E%3Ccircle cx=\'15\' cy=\'9\' r=\'1\' fill=\'%237b8386\'/%3E%3C/svg%3E")',
          transformOrigin: 'center center',
        }}
      />
      {isOpen && position && createPortal(
        <div
          ref={popoverRef}
          className={`custom-emoji-popover popover ${position.placement}`}
          style={{
            position: 'fixed',
            top: `${position.top}px`,
            left: `${position.left}px`,
            width: '352px',
            height: '332px',
            zIndex: 10002, // Higher than ChatWindow (10000) and MessageList (10001) to appear on top
          }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div className="arrow" style={{ left: '50%' }} />
          <div className="cnv-emoji-popout-inner">
            {/* Search Bar - matches AngularJS cnvEmoji.tpl.html line 2-6 */}
            <div className="emojiSearchBar">
              <div className="searchEmojiIcon" style={{ height: '16px', width: '16px' }}></div>
              <input
                ref={searchInputRef}
                className="cnv-emoji-search-field"
                type="text"
                placeholder="Search"
                value={searchText}
                onChange={handleSearchChange}
              />
              {searchText && (
                <a
                  className="clear-search-button icons2_Close-lightgray"
                  onClick={handleClearSearch}
                  style={{ cursor: 'pointer' }}
                ></a>
              )}
            </div>

            {/* Emoji Container - matches AngularJS cnvEmoji.tpl.html line 8-10 */}
            <div ref={containerRef} className="cnv-emoji-container">
              <ul className="emoji-categories-list">
                {filteredCategories.map((category, categoryIndex) => (
                  <li key={category.category} className="emoji-category">
                    <div className="category-label">{category.category}</div>
                    <div className="category-label2" style={{ display: 'none' }}>{category.category}</div>
                    <ul className="emoji-list">
                      {category.emojisList.map((emoji, emojiIndex) => (
                        <li
                          key={`${category.category}-${emojiIndex}`}
                          className="emoji-item"
                          onClick={() => handleEmojiClick(emoji.unicode)}
                          title={emoji.title || emoji.short_name}
                        >
                          {emoji.unicode}
                        </li>
                      ))}
                    </ul>
                    <div className="category-label-bottom" style={{ visibility: 'hidden' }}>
                      {category.category}
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            {/* Category Toolbar - matches AngularJS cnvEmoji.tpl.html line 12-14 */}
            <div className="categories-icon-list-container">
              <ul className="categorires-icon-list">
                {EMOJI_CATEGORIES.map((category, index) => {
                  // Match AngularJS class naming: "Frequently Used" -> "Frequently", "Food" -> "Foods-icon", others -> "Category-icon"
                  let categoryClass: string;
                  if (category.category === 'Frequently Used') {
                    categoryClass = 'Frequently';
                  } else if (category.category === 'Food') {
                    categoryClass = 'Foods-icon';
                  } else {
                    categoryClass = category.category.replace(/\s+/g, '') + '-icon';
                  }
                  return (
                    <li
                      key={category.category}
                      className={`${categoryClass} ${selectedCategory === index ? 'selected' : ''}`}
                      onClick={() => handleCategorySelect(index)}
                      style={{ cursor: 'pointer' }}
                    ></li>
                  );
                })}
              </ul>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
