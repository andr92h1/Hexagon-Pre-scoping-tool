const gulp = require('gulp');
const babel = require('gulp-babel');

function threeToEs5() {

    return gulp
        .src([
            './node_modules/three/src/math/MathUtils.js',
            './node_modules/three/src/math/Quaternion.js',
            './node_modules/three/src/math/Matrix3.js',
            './node_modules/three/src/math/Vector3.js',
            './node_modules/three/src/math/Euler.js',
            './node_modules/three/src/math/Matrix4.js',
        ])
        .pipe(babel({ presets: ['@babel/preset-env'] }))
        .pipe(gulp.dest('lib/three'));

}

gulp.task(threeToEs5);

gulp.task('default', gulp.series(threeToEs5));