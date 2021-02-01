let grp, img;
let img_scale = 0.15,
    frame = 3, // >= 2
    d = 3;

function preload() {
    img = loadImage('assets/ball-rotate.jpg');
}

function setup() {
    createCanvas(500, 500);
    imageMode(CENTER);

    grp = createGraphics(500, 500);
    drawLen();
}

function draw() {
    background(255);

    image(
        img,
        width / 2,
        height / 2,
        img.width * img_scale,
        img.height * img_scale
    );

    image(grp, mouseX, height / 2);
}

function drawLen() {
    grp.clear();
    grp.fill('#000');

    if (frame < 2) frame = 2;

    for (let x = 0; x < 500; x += frame * d)
        grp.rect(x, 0, (frame - 1) * d, height);
}

function keyPressed() {
    if (keyCode == UP_ARROW) {
        frame++;
    } else if (keyCode == DOWN_ARROW) {
        frame--;
    } else if (keyCode == RIGHT_ARROW) {
        d += 0.1;
    } else if (keyCode == LEFT_ARROW) {
        d -= 0.1;
    }

    drawLen();
}

function mouseWheel(e) {
    img_scale += 0.05 * img_scale * (e.delta > 0 ? -1 : 1);
}
