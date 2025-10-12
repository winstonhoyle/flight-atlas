export const getColorByDestinations = (count) => {
    if (count > 100) return "#62eb07ff";
    if (count > 50) return "#fee08b";
    if (count > 10) return "#fc8d59";
    if (count >= 0) return "#ff0000ff";
};