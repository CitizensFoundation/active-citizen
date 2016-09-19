var commonIndexForActivitiesAndNewsFeeds = function(createdAtField) {
  return [
    {
      fields: ['type','user_id'],
      where: {
        status: 'active',
        deleted: false
      }
    },
    {
      fields: ['post_id','user_id'],
      where: {
        status: 'active',
        deleted: false
      }
    },
    {
      fields: ['group_id','user_id'],
      where: {
        status: 'active',
        deleted: false
      }
    },
    {
      fields: ['community_id','user_id'],
      where: {
        status: 'active',
        deleted: false
      }
    },
    {
      fields: ['domain_id','user_id'],
      where: {
        status: 'active',
        deleted: false
      }
    },
    {
      fields: ['type','user_id',createdAtField,'id'],
      where: {
        status: 'active',
        deleted: false
      }
    },
    {
      fields: ['post_id','user_id',createdAtField,'id'],
      where: {
        status: 'active',
        deleted: false
      }
    },
    {
      fields: ['group_id','user_id',createdAtField,'id'],
      where: {
        status: 'active',
        deleted: false
      }
    },
    {
      fields: ['community_id','user_id',createdAtField,'id'],
      where: {
        status: 'active',
        deleted: false
      }
    },
    {
      fields: ['domain_id','user_id',createdAtField,'id'],
      where: {
        status: 'active',
        deleted: false
      }
    },
    {
      fields: ['type','user_id',createdAtField],
      where: {
        status: 'active',
        deleted: false
      }
    },
    {
      fields: ['post_id','user_id', createdAtField],
      where: {
        status: 'active',
        deleted: false
      }
    },
    {
      fields: ['group_id','user_id',createdAtField],
      where: {
        status: 'active',
        deleted: false
      }
    },
    {
      fields: ['community_id','user_id',createdAtField],
      where: {
        status: 'active',
        deleted: false
      }
    },
    {
      fields: ['domain_id','user_id',createdAtField],
      where: {
        status: 'active',
        deleted: false
      }
    }
  ];
};

module.exports = {
  commonIndexForActivitiesAndNewsFeeds: commonIndexForActivitiesAndNewsFeeds
};