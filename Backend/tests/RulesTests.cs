using System.Text.Json;
using LiftTogether.Api.Data;
using LiftTogether.Api.Endpoints;
using LiftTogether.Api.Security;

namespace LiftTogether.Api.Tests;

public sealed class RulesTests
{
    [Fact]
    public void TrainingCompletion_UsesWarsawEndTimeAndRejectsInvalidStates()
    {
        var booking = new Booking { Date = new DateOnly(2026, 10, 14), EndMinute = 18 * 60 };
        var before = DateTimeOffset.Parse("2026-10-14T15:59:00Z");
        Assert.Equal("TRAINING_NOT_FINISHED", Assert.Throws<ApiFault>(() => TrainingStats.RequireCompletable(booking, before)).Code);
        TrainingStats.RequireCompletable(booking, before.AddMinutes(1));
        booking.Cancelled = true;
        Assert.Equal("TRAINING_UNAVAILABLE", Assert.Throws<ApiFault>(() => TrainingStats.RequireCompletable(booking, before.AddMinutes(1))).Code);
        booking.Cancelled = false;
        booking.CompletedAt = before;
        Assert.Throws<ApiFault>(() => TrainingStats.RequireCompletable(booking, before.AddMinutes(1)));
        booking.CompletedAt = null;
        booking.EndMinute = 1440;
        Assert.Throws<ApiFault>(() => TrainingStats.RequireCompletable(booking, DateTimeOffset.Parse("2026-10-14T21:59:00Z")));
        TrainingStats.RequireCompletable(booking, DateTimeOffset.Parse("2026-10-14T22:00:00Z"));
    }

    [Fact]
    public void PrivateNotes_AreOnlyIncludedInAdminDto()
    {
        var member = new Member { AdminNotes = "Identity needs confirmation" };
        var ownProfile = JsonSerializer.SerializeToElement(Dto.User(member));
        Assert.False(ownProfile.TryGetProperty("AdminNotes", out _));
        var adminProfile = JsonSerializer.SerializeToElement(Dto.AdminUser(member));
        Assert.Equal(member.AdminNotes, adminProfile.GetProperty("AdminNotes").GetString());
    }

    [Fact]
    public void Notes_AllowClearingAndRejectOversizedText()
    {
        Assert.Equal("", Rules.Text("  ", 4000, false));
        Assert.Equal(4000, Rules.Text(new string('x', 4000), 4000, false).Length);
        Assert.Throws<ApiFault>(() => Rules.Text(new string('x', 4001), 4000, false));
    }
}
