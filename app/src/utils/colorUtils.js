export const getColorByDestinations = (count) => {
    if (count > 200) return "#047a00ff";
    if (count > 100) return "#62eb07ff";
    if (count > 50) return "#f2f700ff";
    if (count > 10) return "#fc8d59";
    if (count >= 0) return "#ff0000ff";
};