
    /*
     * Anonymous WhatsApp taps, folded in the same way wa_campaigns.php has always done it.
     *
     * A static tracked link is identical in every message, so a tap from a logged-out phone can
     * never stamp journey_messages.first_clicked_at — the counter above therefore reads 0 for a
     * button-only template no matter how many people tapped. wa_link_clicks holds those taps,
     * deduplicated by identity_key, and every person the stamp knows about has a row there too,
     * so GREATEST of the two is exact rather than an estimate.
     *
     * Its OWN statement, and its own table check, on purpose: wa_link_clicks belongs to the
     * WhatsApp feature and this backend deploys folder by folder. Folding it into the UPDATE
     * above would mean a server without that table silently stops updating every other counter
     * in the same statement.
     */
    if (journey_table_exists('wa_link_clicks')) {
        @$conn->query("UPDATE journeys j
                          SET clicked_count = GREATEST(clicked_count,
                              (SELECT COUNT(DISTINCT lc.identity_key) FROM wa_link_clicks lc
                                WHERE lc.journey_id = j.id))
                        WHERE j.id = $jid");
    }
