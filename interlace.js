// Core interlacing math. Pure functions, no canvas — chạy được cả trong node lẫn browser.

function stripPlan(width, stripWidth, n) {
    const plan = [];
    for (let x = 0; x < width; x += stripWidth) {
        plan.push({
            x,
            w: Math.min(stripWidth, width - x),
            frame: Math.floor(x / stripWidth) % n,
        });
    }
    return plan;
}

// Ảnh ở đây là {width, height, data} với data là RGBA — cùng shape với ImageData,
// nên browser truyền thẳng ImageData vào được.

function blankLike(width, height) {
    return { width, height, data: new Uint8ClampedArray(width * height * 4) };
}

function copyColumns(src, srcX, dst, dstX, w, height) {
    for (let y = 0; y < height; y++) {
        const from = (y * src.width + srcX) * 4;
        const to = (y * dst.width + dstX) * 4;
        dst.data.set(src.data.subarray(from, from + w * 4), to);
    }
}

function interlacePixels(frames, { stripWidth }) {
    const { width, height } = frames[0];
    const out = blankLike(width, height);

    for (const strip of stripPlan(width, stripWidth, frames.length)) {
        copyColumns(
            frames[strip.frame],
            strip.x,
            out,
            strip.x,
            strip.w,
            height,
        );
    }
    return out;
}

function deinterlacePixels(img, { stripWidth, n }) {
    const plan = stripPlan(img.width, stripWidth, n);

    const widths = new Array(n).fill(0);
    for (const strip of plan) widths[strip.frame] += strip.w;

    const frames = widths.map((w) => blankLike(w, img.height));
    const cursors = new Array(n).fill(0);

    for (const strip of plan) {
        const f = strip.frame;
        copyColumns(img, strip.x, frames[f], cursors[f], strip.w, img.height);
        cursors[f] += strip.w;
    }
    return frames;
}

// Chọn n frame từ một GIF. Hai kiểu rải khác nhau vì mục đích khác nhau:
//  - thường: bước nhảy đều, KHÔNG lấy frame cuối — với GIF loop thì frame cuối
//    kề frame đầu, lấy cả hai là lặp gần trùng nhau.
//  - ping-pong: phải chạm cả hai đầu mút rồi quay ngược, nên rải kiểu span.
function sampleIndices(total, n, { start = 0, length, pingpong = false } = {}) {
    const len = Math.min(length || total, total - start);
    const clamp = (i) => Math.max(0, Math.min(total - 1, i));

    if (!pingpong) {
        return Array.from({ length: n }, (_, i) =>
            clamp(start + Math.floor((i * len) / n)),
        );
    }

    const m = Math.floor(n / 2) + 1;
    const forward = Array.from({ length: m }, (_, i) =>
        clamp(start + (m === 1 ? 0 : Math.round((i * (len - 1)) / (m - 1)))),
    );
    const cycle = forward.concat(forward.slice(1, -1).reverse());

    return Array.from({ length: n }, (_, i) => cycle[i % cycle.length]);
}

// Strip PHẢI là số nguyên pixel, nếu không mỗi chu kỳ lệch một chút và tích luỹ
// thành moiré trên bản in. Nên làm tròn trước, rồi báo lại LPI thật đạt được.
function printGeometry(dpi, lpi, n) {
    const stripWidth = Math.max(1, Math.round(dpi / (lpi * n)));
    return { stripWidth, actualLpi: dpi / (stripWidth * n) };
}

// Bề rộng hiển thị phải là bội số của chu kỳ strip, nếu không chu kỳ cuối bị cụt
// và lưới lệch pha ở mép ảnh.
function fitSize(srcW, srcH, maxW, maxH, period) {
    const scale = Math.min(maxW / srcW, maxH / srcH);
    const width = Math.max(
        period,
        Math.floor((srcW * scale) / period) * period,
    );
    return { width, height: Math.round((width * srcH) / srcW) };
}

// Sheet barrier-grid: cái phải khớp KHÔNG phải "số frame" mà là chu kỳ mask trên
// màn hình phải bằng chu kỳ sheet nhân tỉ lệ hiển thị. Nên scale là đại lượng
// SUY RA, không được lưu rời — lưu rời là nguồn gốc của việc lệch sau khi resize.
// Sheet barrier-grid. Chỉ có MỘT ràng buộc:
//     chu kỳ mask trên màn hình = chu kỳ sheet × tỉ lệ hiển thị
// Ba đại lượng, một phương trình, nên còn hai bậc tự do. Chọn chu kỳ mask làm
// đại lượng lưu (nó chính là nút zoom) và suy khe ra từ nó — như vậy đổi số khe
// không đụng tới tỉ lệ hiển thị. Làm ngược lại (lưu khe, suy tỉ lệ) thì tăng số
// khe sẽ phình luôn kích thước ảnh.
function sheetGeometry(sheetPeriod, maskPeriod, n) {
    const period = Math.max(2, Math.round(maskPeriod));
    // chừa ít nhất 1px bar, nếu không lưới biến mất và chẳng che gì cả
    const stripWidth = Math.max(
        1,
        Math.min(period - 1, Math.round(period / n)),
    );
    return { maskPeriod: period, stripWidth, scale: period / sheetPeriod };
}

function fitMaskPeriod(srcW, srcH, sheetPeriod, maxW, maxH) {
    const scaleMax = Math.min(maxW / srcW, maxH / srcH);
    return Math.max(2, Math.floor(scaleMax * sheetPeriod));
}

// Dò chu kỳ lược của một sheet.
//
// Hai cái bẫy đã vấp phải khi làm bằng tay ngoài repo, nên ghi lại đây:
//  - Gộp các hàng về một hàng rồi mới đo thì SAI: những vùng lược lệch pha nhau
//    sẽ triệt tiêu lẫn nhau. Phải lấy sai khác trên từng hàng rồi mới cộng.
//  - Lag nhỏ luôn tự thắng vì ảnh vốn giống chính nó ở khoảng cách ngắn (JPEG
//    còn thêm block 8x8). Nên phải chuẩn hoá theo xu hướng cục bộ, và chấm điểm
//    theo bội số: chu kỳ thật phải trũng ở cả p, 2p, 3p.
function detectPeriod(img, { min = 4, max = 150, step = 0.25 } = {}) {
    const { width: W, height: H, data } = img;
    const hi = Math.min(max, W / 5);
    if (hi <= min) return min;

    const rowStep = Math.max(1, Math.floor(H / 60));
    const rows = [];
    for (let y = 0; y < H; y += rowStep) {
        const r = new Float64Array(W);
        for (let x = 0; x < W; x++) {
            const i = (y * W + x) * 4;
            r[x] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        }
        rows.push(r);
    }

    const diffs = [];
    for (let p = min; p <= hi; p += step) {
        let sum = 0;
        let count = 0;
        for (const r of rows) {
            for (let x = 0; x + p + 1 < W; x += 2) {
                const i = Math.floor(x + p);
                const f = x + p - i;
                sum += Math.abs(r[x] - (r[i] * (1 - f) + r[i + 1] * f));
                count++;
            }
        }
        diffs.push(sum / Math.max(1, count));
    }

    const win = Math.round(12 / step);
    const norm = diffs.map((d, i) => {
        let total = 0;
        let m = 0;
        for (
            let j = Math.max(0, i - win);
            j <= Math.min(diffs.length - 1, i + win);
            j++
        ) {
            total += diffs[j];
            m++;
        }
        const mean = total / m;
        return mean > 0 ? d / mean : 1;
    });

    const at = (p) => {
        const i = Math.round((p - min) / step);
        return i >= 0 && i < norm.length ? norm[i] : 1;
    };

    let best = { p: min, score: Infinity };
    for (let i = 0; i < norm.length; i++) {
        const p = min + i * step;
        if (p * 2 > hi) break;
        const score = (norm[i] + at(p * 2) + at(p * 3)) / 3;
        // so sánh chặt: p nhỏ nhất trong các điểm cùng điểm số sẽ thắng, nhờ vậy
        // trả về chu kỳ cơ bản chứ không phải bội của nó
        if (score < best.score - 1e-9) best = { p, score };
    }
    return best.p;
}

// Bề rộng hiển thị của sheet để lại dưới dạng SỐ THỰC. Làm tròn về pixel nguyên
// sẽ đẩy tỉ lệ đi một chút, và chu kỳ sheet trên màn hình lệch khỏi chu kỳ mask
// một lượng nhỏ nhưng DỒN LẠI qua vài chục chu kỳ. drawImage nhận số thực nên
// không có lý do gì phải làm tròn.
function sheetBox(srcW, srcH, sheetPeriod, maskPeriod) {
    const scale = maskPeriod / sheetPeriod;
    return { width: srcW * scale, height: srcH * scale, scale };
}

const api = {
    stripPlan,
    interlacePixels,
    deinterlacePixels,
    sampleIndices,
    printGeometry,
    fitSize,
    sheetGeometry,
    fitMaskPeriod,
    detectPeriod,
    sheetBox,
};

if (typeof module !== 'undefined' && module.exports) module.exports = api;
if (typeof window !== 'undefined') window.Interlace = api;
