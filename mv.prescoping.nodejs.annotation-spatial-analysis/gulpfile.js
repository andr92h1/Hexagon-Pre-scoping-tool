const gulp = require('gulp');

function buildDependencies() {

    return gulp
        .src([
            '../mv.prescoping.nodejs.core/lib/**/*'
        ])
        .pipe(gulp.dest('lib'));

}

gulp.task(buildDependencies);

gulp.task('default', gulp.series(buildDependencies));