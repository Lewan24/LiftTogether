using System.Text.Json;
using LiftTogether.Api.Data;
using LiftTogether.Api.Security;

namespace LiftTogether.Api.Tests;

public sealed class RulesTests
{
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
