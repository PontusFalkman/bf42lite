// apps/client-tauri/src-tauri/src/maps/warehouse.rs

use crate::protocol::TeamId;
use crate::sim::FlagZone;

/// Create the Conquest flags for the MVP Warehouse map.
///
/// For now this is identical to the previous hard-coded test layout:
/// - Flag 1: center / spawn flag
/// - Flag 2: positive X side
/// - Flag 3: negative X side
pub fn create_flags() -> Vec<FlagZone> {
    vec![
        FlagZone {
            id: 1,
            x: 0.0,
            y: 0.0,
            z: 0.0,
            radius: 8.0,
            owner: TeamId::None,
            capture: 0.0,
        },
        FlagZone {
            id: 2,
            x: 40.0,
            y: 0.0,
            z: 10.0,
            radius: 8.0,
            owner: TeamId::None,
            capture: 0.0,
        },
        FlagZone {
            id: 3,
            x: -40.0,
            y: 0.0,
            z: -10.0,
            radius: 8.0,
            owner: TeamId::None,
            capture: 0.0,
        },
    ]
}
