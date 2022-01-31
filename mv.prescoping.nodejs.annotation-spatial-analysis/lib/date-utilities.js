exports.toFormatString = function (date, format) {
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const monthDay = date.getDate();
    return year + '-' + (month < 10 ? '0' + month : month) + '-' + (monthDay < 10 ? '0' + monthDay : monthDay);
}