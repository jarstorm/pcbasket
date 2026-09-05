import { getAmenityOptions, amenityAttendanceBonus, amenityPriceTolerance } from "../amenities";

describe("amenities", () => {
  it("starts every amenity at level 0 with the first tier name as the next upgrade", () => {
    const options = getAmenityOptions({ level: 1, amenities: {} });
    const shops = options.find((a) => a.id === "shops");
    expect(shops.level).toBe(0);
    expect(shops.maxed).toBe(false);
    expect(shops.currentTierName).toBeNull();
    expect(shops.nextTierName).toBe("Puesto pequeño");
  });

  it("reports the current tier name and the next one once partially upgraded", () => {
    const options = getAmenityOptions({ level: 1, amenities: { shops: 2 } });
    const shops = options.find((a) => a.id === "shops");
    expect(shops.currentTierName).toBe("Tienda");
    expect(shops.nextTierName).toBe("Tienda oficial");
  });

  it("maxes out at level 5 with no further upgrade", () => {
    const options = getAmenityOptions({ level: 1, amenities: { shops: 5 } });
    const shops = options.find((a) => a.id === "shops");
    expect(shops.maxed).toBe(true);
    expect(shops.nextTierName).toBeNull();
    expect(shops.cost).toBeNull();
  });

  it("scales cost with stadium level and with the amenity's own level", () => {
    const level1 = getAmenityOptions({ level: 1, amenities: {} });
    const level2 = getAmenityOptions({ level: 2, amenities: {} });
    level1.forEach((a, i) => expect(level2[i].cost).toBeGreaterThan(a.cost));

    const base = getAmenityOptions({ level: 1, amenities: { shops: 0 } }).find((a) => a.id === "shops");
    const upgraded = getAmenityOptions({ level: 1, amenities: { shops: 1 } }).find((a) => a.id === "shops");
    expect(upgraded.cost).toBeGreaterThan(base.cost);
  });

  it("sums attendance bonus and price tolerance scaled by each amenity's level", () => {
    const level1 = amenityAttendanceBonus({ level: 1, amenities: { shops: 1 } });
    const level3 = amenityAttendanceBonus({ level: 1, amenities: { shops: 3 } });
    expect(level3).toBeGreaterThan(level1);
    expect(amenityAttendanceBonus({ level: 1, amenities: {} })).toBe(0);

    const tolerance = amenityPriceTolerance({ level: 1, amenities: { stands: 1 } });
    expect(tolerance).toBeGreaterThan(0);
  });
});
