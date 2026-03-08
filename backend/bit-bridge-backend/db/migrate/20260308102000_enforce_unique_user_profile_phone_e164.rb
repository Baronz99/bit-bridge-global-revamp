class EnforceUniqueUserProfilePhoneE164 < ActiveRecord::Migration[7.1]
  disable_ddl_transaction!

  UNIQUE_INDEX = 'index_user_profiles_on_phone_e164_unique'
  LEGACY_INDEX = 'index_user_profiles_on_phone_e164'

  def up
    execute <<~SQL.squish
      UPDATE user_profiles
      SET phone_number = NULL
      WHERE phone_number IS NOT NULL AND btrim(phone_number) = ''
    SQL

    execute <<~SQL.squish
      UPDATE user_profiles
      SET phone_number = btrim(phone_number)
      WHERE phone_number IS NOT NULL AND phone_number <> btrim(phone_number)
    SQL

    execute <<~SQL.squish
      UPDATE user_profiles
      SET phone_e164 = CASE
        WHEN regexp_replace(phone_number, '[^0-9]', '', 'g') ~ '^0[0-9]{10}$'
          THEN '234' || substr(regexp_replace(phone_number, '[^0-9]', '', 'g'), 2)
        WHEN regexp_replace(phone_number, '[^0-9]', '', 'g') ~ '^[0-9]{10}$'
          THEN '234' || regexp_replace(phone_number, '[^0-9]', '', 'g')
        WHEN regexp_replace(phone_number, '[^0-9]', '', 'g') ~ '^234[0-9]{10}$'
          THEN regexp_replace(phone_number, '[^0-9]', '', 'g')
        ELSE NULL
      END
      WHERE phone_number IS NOT NULL
    SQL

    duplicate_rows = select_rows(<<~SQL.squish)
      SELECT phone_e164, COUNT(*)
      FROM user_profiles
      WHERE phone_e164 IS NOT NULL AND phone_e164 <> ''
      GROUP BY phone_e164
      HAVING COUNT(*) > 1
    SQL

    if duplicate_rows.any?
      sample = duplicate_rows.first(5).map { |value, count| "#{value} (#{count})" }.join(', ')
      raise <<~MSG
        Cannot enforce unique phone_e164 index. Resolve duplicate canonical phones first.
        Sample duplicates: #{sample}
      MSG
    end

    remove_index :user_profiles, name: LEGACY_INDEX, if_exists: true, algorithm: :concurrently

    add_index :user_profiles,
              :phone_e164,
              unique: true,
              where: "phone_e164 IS NOT NULL AND phone_e164 <> ''",
              name: UNIQUE_INDEX,
              algorithm: :concurrently
  end

  def down
    remove_index :user_profiles, name: UNIQUE_INDEX, if_exists: true, algorithm: :concurrently

    add_index :user_profiles,
              :phone_e164,
              name: LEGACY_INDEX,
              algorithm: :concurrently
  end
end
