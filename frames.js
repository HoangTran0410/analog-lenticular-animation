// Cầu nối giữa core thuần (ImageData) và canvas của trình duyệt.

function offscreen(w, h) {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    return c;
}

function toImageData(img) {
    return img instanceof ImageData
        ? img
        : new ImageData(img.data, img.width, img.height);
}

function canvasFromImageData(img) {
    const c = offscreen(img.width, img.height);
    c.getContext('2d').putImageData(toImageData(img), 0, 0);
    return c;
}

function imageDataFromDrawable(drawable, w, h) {
    const ctx = offscreen(w, h).getContext('2d');
    ctx.drawImage(drawable, 0, 0, w, h);
    return ctx.getImageData(0, 0, w, h);
}

// Resize TỪNG frame rồi mới interlace. Làm ngược lại — interlace xong mới scale —
// chính là nguồn ghosting: bộ nội suy trộn cột của các frame khác nhau vào nhau.
function resizeFrame(img, w, h) {
    const ctx = offscreen(w, h).getContext('2d');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(canvasFromImageData(img), 0, 0, w, h);
    return ctx.getImageData(0, 0, w, h);
}

// Lưới che: mỗi chu kỳ chừa một khe rộng đúng stripWidth, phần còn lại bịt đen.
// Chu kỳ truyền vào tường minh chứ không suy từ stripWidth * n: ở chế độ sheet
// chu kỳ mới là đại lượng gốc, còn khe là thứ suy ra.
function gratingCanvas(width, height, stripWidth, period) {
    const c = offscreen(width, height);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#000';
    for (let x = 0; x < width; x += period) {
        ctx.fillRect(x + stripWidth, 0, period - stripWidth, height);
    }
    return c;
}

function downloadCanvas(canvas, filename) {
    canvas.toBlob((blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
    }, 'image/png');
}

window.Frames = {
    offscreen,
    canvasFromImageData,
    imageDataFromDrawable,
    resizeFrame,
    gratingCanvas,
    downloadCanvas,
};
