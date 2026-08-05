// Truncation is the product. Comprehensiveness is our competitors' value
// proposition and the thing we deliberately do not do.

import Foundation

/// Maximum recipes surfaced per bucket.
let bucketCap = 4

let bucketOrder: [Bucket] = [.ready, .missingFew, .missingSome, .groceryRun]

/// Bucketing is by COUNT of missing ingredients, not by match percentage:
/// 0 -> ready | 1-2 -> missing few | 3-4 -> missing some | 5+ -> grocery run.
///
/// Count rather than ratio because "you are two ingredients away" means the
/// same thing to a user whether the recipe has 5 ingredients or 15.
func bucketFor(missingCount: Int) -> Bucket {
    switch missingCount {
    case 0:     return .ready
    case 1...2: return .missingFew
    case 3...4: return .missingSome
    default:    return .groceryRun
    }
}
