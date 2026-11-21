// The story of Port Solara in five jobs. Nico Vale comes home to find Victor Haldane, a developer
// with a crooked police captain in his pocket, squeezing the Saltworks Docks so he can pour concrete
// over them. Mari Okafor, who runs the Lucky Gull bait shop and half the docks' side business, wants
// him gone. Each mission is data: who gives it, what is said, the steps, the reward.

export const STORY_INTRO = [
  ['Mari', 'Nico Vale. Three years on the rigs and you come home on the ferry like a tourist.', 4.5],
  ['Mari', "Haldane's buying the docks out from under us. I need someone I trust. Come see me at the Lucky Gull.", 5],
];

export const MISSIONS = [
  {
    id: 'wheels-up',
    title: 'Wheels Up',
    reward: 500,
    autoStart: true,
    steps: [
      { type: 'dialogue', lines: STORY_INTRO },
      { type: 'enterVehicle', text: 'Get yourself a car. Walk up to one and press F.' },
      { type: 'goto', place: 'gullCurb', inVehicle: true, text: 'Drive to the Lucky Gull in Saltworks Docks.' },
      { type: 'goto', place: 'gullDoor', onFoot: true, text: 'Get out and talk to Mari.' },
      {
        type: 'dialogue',
        lines: [
          ['Mari', 'Look at you. Still drive like the road owes you money.', 3.5],
          ['Nico', 'It does. So what does Haldane want with a bait shop?', 3.5],
          ['Mari', 'Not the shop. The waterfront. "Haldane Marina Residences". Glass boxes for people who never fish.', 5],
          ['Mari', "Hang around. I'll have work for you. Real work.", 3.5],
        ],
      },
    ],
  },
  {
    id: 'hot-cargo',
    title: 'Hot Cargo',
    reward: 900,
    steps: [
      {
        type: 'dialogue',
        lines: [
          ['Mari', "There's a crate of mine at the end of Coral Pier, by the Sunwheel. Haldane's people heard about it.", 4.5],
          ['Mari', 'Get there first and bring it back here. Fast.', 3],
        ],
      },
      { type: 'goto', place: 'pierCrate', onFoot: true, text: "Grab Mari's crate at the end of Coral Pier." },
      { type: 'pickup', item: 'crate', text: 'Picked up the crate.' },
      { type: 'phone', lines: [['Mari', "Haldane's boys know you've got it. Don't stop for anything.", 3.5]] },
      { type: 'goto', place: 'gullCurb', inVehicle: true, timeLimit: 150, text: 'Deliver the crate to the Lucky Gull before Haldane finds you.' },
      { type: 'dialogue', lines: [['Mari', 'Fishing reels, flares and a radio Haldane really did not want us to have. Nice work.', 4]] },
    ],
  },
  {
    id: 'taco-tuesday',
    title: 'Taco Tuesday',
    reward: 1500,
    steps: [
      {
        type: 'dialogue',
        lines: [
          ['Mari', "Rosa's taco truck up in Palmetto Heights won't sell to Haldane. Now his enforcers are 'inspecting' it.", 5],
          ['Mari', 'Take this. Brass & Barrel sells more if you run low. Make them leave.', 4],
        ],
      },
      { type: 'givePistol', ammo: 48 },
      { type: 'goto', place: 'tacoTruck', text: 'Go to the Taco Tormenta truck in Palmetto Heights.', radius: 30 },
      { type: 'eliminate', place: 'tacoTruck', count: 4, text: "Take out Haldane's enforcers" },
      { type: 'phone', lines: [['Rosa', "Gracias! Tell Mari her tacos are free for life. Now go before the cops come!", 4]] },
      { type: 'loseWanted', text: 'Lose the police.' },
    ],
  },
  {
    id: 'paper-trail',
    title: 'Paper Trail',
    reward: 3000,
    steps: [
      {
        type: 'dialogue',
        lines: [
          ['Mari', "Haldane moves his real books in an armored courier van. Every bribe, every 'permit'.", 4.5],
          ['Mari', "It's leaving Haldane Tower right now. Take the van, lose the cops, bring it home.", 4.5],
        ],
      },
      { type: 'spawnVehicle', ref: 'courier', vehicle: 'courier', place: 'towerRoad', driver: 'npc' },
      { type: 'enterVehicle', ref: 'courier', text: 'Steal the Haldane Courier van.' },
      { type: 'forceWanted', stars: 3 },
      { type: 'loseWanted', text: 'The van has a tracker. Lose the police.' },
      { type: 'goto', place: 'gullCurb', inVehicle: true, ref: 'courier', text: 'Bring the courier van to the Lucky Gull.' },
      { type: 'dialogue', lines: [['Mari', "Captain Brandt's name is all over these. Haldane's cop. He's done. Haldane's next.", 4.5]] },
    ],
  },
  {
    id: 'last-light',
    title: 'Last Light',
    reward: 5000,
    steps: [
      {
        type: 'dialogue',
        lines: [
          ['Mari', "Haldane saw the papers in the Courier this morning. He's running for his seaplane.", 4.5],
          ['Nico', "Then he doesn't get to the water.", 2.8],
        ],
      },
      { type: 'spawnVehicle', ref: 'haldane', vehicle: 'kestrel', paint: '#d4af37', place: 'towerRoad', driver: 'npc', panic: true, health: 220 },
      { type: 'destroyVehicle', ref: 'haldane', text: "Wreck Victor Haldane's gold Kestrel GT." },
      { type: 'forceWanted', stars: 4 },
      { type: 'phone', lines: [['Mari', "That's it. That's the whole city watching the sunset over his car. Now get out of there!", 4.5]] },
      { type: 'loseWanted', text: 'Lose the police.' },
      { type: 'goto', place: 'gullDoor', onFoot: true, text: 'Meet Mari at the Lucky Gull.' },
      {
        type: 'dialogue',
        lines: [
          ['Mari', 'The docks stay ours. The Gull stays open. And you, Nico Vale, are staying put.', 4.5],
          ['Nico', 'Somebody has to keep the road paying what it owes.', 3.5],
        ],
      },
    ],
  },
];
