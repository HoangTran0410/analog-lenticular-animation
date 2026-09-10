// Khớp với @media trong index.html: cửa sổ hẹp thì panel co lại, nếu không panel
// ăn hết chỗ và không còn kích thước hợp lệ nào cho ảnh.
const PANEL_W = 300;
const PANEL_W_NARROW = 200;

// `period` = chu kỳ lặp của lược vẽ trên sheet, tính bằng pixel của file gốc.
// Đây là số đã kiểm: dò tự động (detectPeriod) trên từng file, rồi đối chiếu với
// đo độc lập trên 5 băng ngang, rồi đối chiếu tiếp với config hand-tuned trong
// commit đầu tiên của repo (img_scale 0.15, frame 3, d 3 -> 9/0.15 = 60px).
// Sheet do người dùng thả vào không có ở đây thì tự dò.
const SHEETS = [
    { file: 'ball-rotate.jpg', period: 60 },
    { file: 'minecraft.jpg', period: 60 },
    { file: 'skull.jpg', period: 60 },
    { file: 'heart-rotate.jpg', period: 6.25 },
    { file: 'woman.jpg', period: 19.75 },
    { file: 'cat.jpg', period: 6.5 },
    { file: 'wow.png', period: 6.5 },
    { file: 'hourse.png', period: 7 },
];

// Các sheet gốc dùng tỉ lệ chu kỳ/khe = 3 (frame = 3 trong bản đầu tiên).
const SHEET_N = 3;

const state = {
    mode: 'sheet',
    n: SHEET_N,
    showGrating: true,

    // --- chế độ sheet ---
    sheet: null,
    sheetPeriod: 60, // chu kỳ trên file gốc
    maskPeriod: 9, // chu kỳ trên màn hình; đây chính là nút zoom
    userZoomed: false,

    // --- chế độ frames (GIF) ---
    stripWidth: 3,
    pingpong: false,
    rangeStart: 0,
    rangeLength: 6,
    baseFrames: [],
    interlaced: null,

    srcW: 1,
    srcH: 1,
    grating: null,
    box: null,
    offset: 0,
    hint: true,
    status: 'đang tải...',
};

function setup() {
    pixelDensity(1);
    createCanvas(windowWidth, windowHeight);
    textAlign(CENTER, CENTER);
    textSize(16);
    UI.init();
    loadSheet(SHEETS[0].file);
}

function availW() {
    return Math.max(80, windowWidth - panelW() - 60);
}

function availH() {
    return Math.max(80, windowHeight - 60);
}

function panelW() {
    return windowWidth <= 700 ? PANEL_W_NARROW : PANEL_W;
}

// Chế độ sheet có một ràng buộc duy nhất:
//     chu kỳ mask trên màn hình = chu kỳ sheet × tỉ lệ hiển thị
// nên chỉ cần lưu chu kỳ mask, còn khe và tỉ lệ đều suy ra. Nhờ vậy đổi số khe
// không đụng tới kích thước hiển thị.
function geometry() {
    if (state.mode === 'sheet') {
        return Interlace.sheetGeometry(
            state.sheetPeriod,
            state.maskPeriod,
            state.n,
        );
    }
    return {
        maskPeriod: state.n * state.stripWidth,
        stripWidth: state.stripWidth,
        scale: null,
    };
}

// ---- nguồn ----

function loadSheet(name) {
    const entry = SHEETS.find((s) => s.file === name) || SHEETS[0];
    state.status = 'đang tải ' + entry.file + '...';
    loadImage(
        `assets/${entry.file}`,
        (img) => adoptSheet(img, entry.file, entry.period),
        () => {
            state.status = 'không tải được ' + entry.file;
            UI.sync();
        },
    );
}

function adoptSheet(img, name, knownPeriod) {
    state.mode = 'sheet';
    state.sheet = img;
    state.srcW = img.width;
    state.srcH = img.height;
    state.n = SHEET_N;
    state.userZoomed = false;
    state.sheetPeriod =
        knownPeriod != null ? knownPeriod : detectSheetPeriod(img);
    state.maskPeriod = Interlace.fitMaskPeriod(
        img.width,
        img.height,
        state.sheetPeriod,
        availW(),
        availH(),
    );
    state.status = `${name} — chu kỳ sheet ${state.sheetPeriod}px${
        knownPeriod != null ? '' : ' (tự dò)'
    }`;
    rebuild();
    UI.sync();
}

function detectSheetPeriod(img) {
    const px = Frames.imageDataFromDrawable(img.canvas, img.width, img.height);
    return Interlace.detectPeriod(px, {
        min: Math.max(4, img.width / 300),
        max: 150,
    });
}

// Dò lại chu kỳ của sheet đang mở, kể cả sheet có sẵn — để đối chiếu với số
// trong bảng hoặc sửa khi bảng sai.
function rescanSheetPeriod() {
    if (state.mode !== 'sheet' || !state.sheet) return;
    setSheetPeriod(detectSheetPeriod(state.sheet), true);
}

function setSheetPeriod(period, refit) {
    if (!(period > 0)) return;
    state.sheetPeriod = period;
    if (refit) {
        state.maskPeriod = Interlace.fitMaskPeriod(
            state.srcW,
            state.srcH,
            period,
            availW(),
            availH(),
        );
    }
    state.status = `chu kỳ sheet ${period}px`;
    rebuild();
    UI.sync();
}

function loadDroppedFile(file) {
    const url = URL.createObjectURL(file);
    state.status = 'đang đọc ' + file.name + '...';
    UI.sync();

    loadImage(
        url,
        (img) => {
            URL.revokeObjectURL(url);
            // p5 chỉ gắn gifProperties khi là GIF nhiều frame; ảnh tĩnh (kể cả
            // GIF một frame) thì dùng làm sheet.
            if (img.gifProperties) adoptGif(img, file.name);
            else adoptSheet(img, file.name, null);
        },
        () => {
            URL.revokeObjectURL(url);
            state.status = 'không đọc được ' + file.name;
            UI.sync();
        },
    );
}

function adoptGif(img, name) {
    const gp = img.gifProperties;
    if (typeof img.pause === 'function') img.pause();

    state.mode = 'frames';
    state.baseFrames = gp.frames.map((f) => f.image);
    state.srcW = img.width;
    state.srcH = img.height;
    state.n = Math.min(6, gp.numFrames);
    state.stripWidth = 3;
    // GIF dài mà rải đều toàn bộ thì hai frame liền kề cách nhau quá xa, mắt
    // không nối thành chuyển động, chỉ thấy nhấp nháy. Mặc định lấy một đoạn
    // ngắn rồi để người dùng tự kéo range.
    state.rangeStart = 0;
    state.rangeLength = gp.numFrames <= 24 ? gp.numFrames : 12;
    state.status = `${name} — ${gp.numFrames} frame`;
    rebuild();
    UI.sync();
}

function currentFrames() {
    const idx = Interlace.sampleIndices(state.baseFrames.length, state.n, {
        start: state.rangeStart,
        length: state.rangeLength,
        pingpong: state.pingpong,
    });
    return idx.map((i) => state.baseFrames[i]);
}

// ---- dựng ảnh ----

function rebuild() {
    const g = geometry();

    if (state.mode === 'sheet') {
        if (!state.sheet) return;
        state.box = {
            width: Math.max(1, Math.round(state.srcW * g.scale)),
            height: Math.max(1, Math.round(state.srcH * g.scale)),
        };
    } else {
        if (!state.baseFrames.length) return;
        state.box = Interlace.fitSize(
            state.srcW,
            state.srcH,
            Math.max(g.maskPeriod, availW()),
            Math.max(g.maskPeriod, availH()),
            g.maskPeriod,
        );
        const resized = currentFrames().map((f) =>
            Frames.resizeFrame(f, state.box.width, state.box.height),
        );
        state.interlaced = Frames.canvasFromImageData(
            Interlace.interlacePixels(resized, { stripWidth: g.stripWidth }),
        );
    }

    state.grating = Frames.gratingCanvas(
        state.box.width + 2 * g.maskPeriod,
        state.box.height,
        g.stripWidth,
        g.maskPeriod,
    );
}

function draw() {
    background(51);

    if (!state.box) {
        fill(200);
        noStroke();
        text(state.status, (windowWidth - panelW()) / 2, height / 2);
        return;
    }

    const { width: bw, height: bh } = state.box;
    const x = Math.round((windowWidth - panelW() - bw) / 2);
    const y = Math.round((height - bh) / 2);
    const ctx = drawingContext;

    ctx.imageSmoothingEnabled = state.mode === 'sheet';
    if (state.mode === 'sheet') ctx.drawImage(state.sheet.canvas, x, y, bw, bh);
    else ctx.drawImage(state.interlaced, x, y);

    if (state.showGrating) drawGrating(ctx, x, y, bw, bh);
    if (state.hint) drawHint(x, y);
}

function drawGrating(ctx, x, y, bw, bh) {
    const period = geometry().maskPeriod;
    // Bo về số nguyên: vẽ ở toạ độ lẻ thì viền bar bị khử răng cưa và để lọt
    // frame kế bên.
    const off = ((Math.round(state.offset) % period) + period) % period;

    // Lưới rộng hơn ảnh hai chu kỳ để trượt bao nhiêu cũng phủ kín, nhưng phải
    // cắt đúng khung ảnh, nếu không phần thừa thò ra ngoài mép.
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, bw, bh);
    ctx.clip();
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(state.grating, x - period + off, y);
    ctx.restore();
}

function drawHint(x, y) {
    noStroke();
    fill('#000a');
    rect(x, y + state.box.height / 2 - 26, state.box.width, 52);
    fill(255);
    text('← KÉO NGANG →', x + state.box.width / 2, y + state.box.height / 2);
}

// ---- xuất bản in ----

function exportPrint(kind, dpi, lpi, inches) {
    const geo = Interlace.printGeometry(dpi, lpi, state.n);
    const period = geo.stripWidth * state.n;
    const box = Interlace.fitSize(
        state.srcW,
        state.srcH,
        Math.round(inches * dpi),
        1e9,
        period,
    );
    const tag = `${state.n}f-${geo.actualLpi.toFixed(2).replace(/\.?0+$/, '')}lpi`;

    if (kind === 'grid') {
        Frames.downloadCanvas(
            Frames.gratingCanvas(box.width, box.height, geo.stripWidth, period),
            `grid-${tag}.png`,
        );
        return;
    }

    const resized = currentFrames().map((f) =>
        Frames.resizeFrame(f, box.width, box.height),
    );
    Frames.downloadCanvas(
        Frames.canvasFromImageData(
            Interlace.interlacePixels(resized, { stripWidth: geo.stripWidth }),
        ),
        `interlaced-${tag}.png`,
    );
}

// ---- tương tác ----

function inPanel(e) {
    return e && e.target && e.target.closest && e.target.closest('#panel');
}

function mouseDragged(e) {
    if (inPanel(e)) return;
    state.hint = false;
    state.offset += mouseX - pmouseX;
}

// Zoom của sheet nhảy theo bậc chu kỳ nguyên, không trượt liên tục: trượt liên
// tục sẽ phá vỡ đẳng thức chu kỳ mask = chu kỳ sheet × tỉ lệ.
function zoomBy(delta) {
    if (state.mode === 'sheet') {
        state.maskPeriod = constrain(state.maskPeriod + delta, 2, 400);
    } else {
        state.stripWidth = constrain(state.stripWidth + delta, 1, 12);
    }
    state.userZoomed = true;
    rebuild();
    UI.sync();
}

function mouseWheel(e) {
    if (inPanel(e)) return;
    zoomBy(e.delta > 0 ? -1 : 1);
    return false;
}

function keyPressed() {
    if (document.activeElement && document.activeElement.closest('#panel'))
        return;

    if (keyCode === UP_ARROW) state.n = constrain(state.n + 1, 2, 16);
    else if (keyCode === DOWN_ARROW) state.n = constrain(state.n - 1, 2, 16);
    else if (keyCode === RIGHT_ARROW) return (zoomBy(1), false);
    else if (keyCode === LEFT_ARROW) return (zoomBy(-1), false);
    else if (key === ' ') state.showGrating = !state.showGrating;
    else return;

    rebuild();
    UI.sync();
    return false;
}

function windowResized() {
    resizeCanvas(windowWidth, windowHeight, true);

    // Chế độ frames tự tính lại kích thước trong rebuild(). Chế độ sheet thì tỉ
    // lệ bị buộc theo chu kỳ mask, nên phải chọn lại chu kỳ mới refit được —
    // đây chính là chỗ trước đây ảnh kẹt nguyên kích thước cũ sau khi resize.
    if (state.mode === 'sheet' && state.sheet) {
        const fit = () =>
            (state.maskPeriod = Interlace.fitMaskPeriod(
                state.srcW,
                state.srcH,
                state.sheetPeriod,
                availW(),
                availH(),
            ));
        if (!state.userZoomed) fit();
        else if (state.box.width > availW() || state.box.height > availH())
            fit();
    }

    rebuild();
    UI.sync();
}
