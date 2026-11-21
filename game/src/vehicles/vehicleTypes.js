// Port Solara's own car line-up: names, sizes, handling and paint for each model on the road.

export const VEHICLE_TYPES = {
  marlin: {
    name: 'Marlin Sedan', shape: 'sedan', length: 4.6, width: 1.9, height: 1.45, wheel: 0.36,
    maxSpeed: 40, accel: 12, brake: 26, grip: 7.5, steer: 0.62, mass: 1.0, health: 100,
    paints: ['#e8e4dc', '#2d5d8a', '#b23a48', '#3f4a56', '#8fb8c9', '#d9b26f'],
  },
  kestrel: {
    name: 'Kestrel GT', shape: 'sports', length: 4.4, width: 2.0, height: 1.18, wheel: 0.36,
    maxSpeed: 56, accel: 18, brake: 30, grip: 8.8, steer: 0.58, mass: 0.95, health: 90,
    paints: ['#ff5d3a', '#ffd23f', '#1fb5a3', '#f2f2f2', '#2b2d42', '#e63980'],
  },
  bodega: {
    name: 'Bodega Van', shape: 'van', length: 5.2, width: 2.1, height: 2.3, wheel: 0.4,
    maxSpeed: 31, accel: 8, brake: 20, grip: 6.2, steer: 0.6, mass: 1.6, health: 140,
    paints: ['#f1efe9', '#4f7a6a', '#f6c453', '#7d8fa3'],
  },
  surfline: {
    name: 'Surfline Pickup', shape: 'pickup', length: 5.0, width: 2.05, height: 1.75, wheel: 0.44,
    maxSpeed: 38, accel: 11, brake: 24, grip: 6.8, steer: 0.6, mass: 1.35, health: 130,
    paints: ['#3a7ca5', '#d1495b', '#edae49', '#66a182', '#2f2f2f'],
  },
  vireo: {
    name: 'Vireo Cab', shape: 'sedan', length: 4.6, width: 1.9, height: 1.45, wheel: 0.36, taxi: true,
    maxSpeed: 39, accel: 12, brake: 26, grip: 7.5, steer: 0.62, mass: 1.0, health: 100,
    paints: ['#ffc531'],
  },
  patrol: {
    name: 'PSPD Interceptor', shape: 'sedan', length: 4.8, width: 1.95, height: 1.5, wheel: 0.38, police: true,
    maxSpeed: 50, accel: 16, brake: 30, grip: 8.4, steer: 0.62, mass: 1.15, health: 160,
    paints: ['#f4f4f4'],
  },
  courier: {
    name: 'Haldane Courier', shape: 'van', length: 5.6, width: 2.2, height: 2.5, wheel: 0.44, armored: true,
    maxSpeed: 34, accel: 9, brake: 22, grip: 6.5, steer: 0.58, mass: 2.0, health: 300,
    paints: ['#1d3047'],
  },
};

/** The models that make up ordinary traffic, weighted by how common they are. */
export const TRAFFIC_MIX = ['marlin', 'marlin', 'marlin', 'vireo', 'bodega', 'surfline', 'surfline', 'kestrel'];
export const PARKED_MIX = ['marlin', 'kestrel', 'surfline', 'marlin', 'kestrel', 'bodega'];
