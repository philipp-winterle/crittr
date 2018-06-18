const fs     = require('fs-extra');
const path   = require('path');
const gulp   = require('gulp');
const uglify = require('gulp-uglify-es').default;
const clean  = require('gulp-clean');

const srcDir = path.join("./", "src", "**");
const libDir = path.join("./", "lib");


gulp.task('cleanup', () => {
    return gulp.src(libDir, {read: false})
               .pipe(clean());
});

gulp.task('build', () => {
    return gulp.src(srcDir, {base: './src/'})
               .pipe(uglify({}))
               .pipe(gulp.dest(libDir));
});

gulp.task('default', gulp.series('cleanup', 'build'));

