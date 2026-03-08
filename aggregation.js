db.vocabularies.aggregate([
    {
        $group: {
            _id: "$word",
            ids: { $push: "$_id" },
            count: { $sum: 1 }
        }
    },
    {
        $match: {
            count: { $gt: 1 }
        }
    }
]).forEach(function (doc) {
    doc.ids.shift();
    db.vocabularies.deleteMany({ _id: { $in: doc.ids } });
})